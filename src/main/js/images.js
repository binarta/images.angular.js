angular.module('image-management', ['config', 'checkpoint', 'image.rest', 'notifications', 'ui.bootstrap.modal', 'toggle.edit.mode', 'rest.client'])
    .service('imageManagement', ['$q', 'config', 'imagePathBuilder', 'activeUserHasPermission', 'uploader', '$rootScope', '$timeout', ImageManagementService])
    .directive('imageShow', ['config', 'topicRegistry', 'activeUserHasPermission', 'topicMessageDispatcher', '$timeout', '$rootScope', 'imagePathBuilder', ImageShowDirectiveFactory])
    .directive('binImage', ['imageManagement', BinImageDirectiveFactory])
    .directive('binBackgroundImage', ['imageManagement', BinBackgroundImageDirectiveFactory])
    .factory('imagePathBuilder', ['$rootScope', ImagePathBuilderFactory])
    .controller('ImageUploadDialogController', ['$scope', '$modal', 'config', ImageUploadDialogController])
    .controller('ImageController', ['$scope', 'uploader', 'config', '$rootScope', 'topicMessageDispatcher', 'imagePathBuilder', ImageController])
    .controller('binImageController', ['$scope', '$element', '$q', 'imageManagement', 'editModeRenderer', 'activeUserHasPermission', 'ngRegisterTopicHandler', '$window', BinImageController])
    .controller('binImagesController', ['$rootScope', '$q', 'restServiceHandler', 'config', 'editModeRenderer', '$templateCache', 'imageManagement', BinImagesController])
    .run(['$rootScope', '$location', 'topicRegistry', 'topicMessageDispatcher', function ($rootScope, $location, topicRegistry, topicMessageDispatcher) {
        var imageCount = 0;

        $rootScope.$watch(function () {
            return $location.path();
        }, function () {
            imageCount = 0;
        });

        topicRegistry.subscribe('image.loading', function (topic) {
            if (topic == 'loading') {
                imageCount++;
            } else {
                if (imageCount > 0) reduceImageCount();
            }
        });

        function reduceImageCount() {
            imageCount--;
            if (imageCount == 0) topicMessageDispatcher.fire('images.loaded', 'ok');
        }

        $rootScope.image = {
            uploaded: [],
            defaultTimeStamp: new Date().getTime()
        };
    }]);

function ImageManagementService ($q, config, imagePathBuilder, activeUserHasPermission, uploader, $rootScope, $timeout) {
    var self = this;

    this.getLowerbound = function () {
        return config.image && config.image.upload && config.image.upload.lowerbound ? config.image.upload.lowerbound : 1024;
    };

    this.getUpperbound = function () {
        return config.image && config.image.upload && config.image.upload.upperbound ? config.image.upload.upperbound : 10485760;
    };

    this.getImagePath = function (args) {
        var deferred = $q.defer();

        activeUserHasPermission({
            no: function () {
                deferred.resolve(get(config.image && config.image.cache));
            },
            yes: function () {
                deferred.resolve(get(false));
            }
        }, 'image.upload');

        function get(cache) {
            return config.awsPath + imagePathBuilder({
                    cache: cache,
                    path: args.code,
                    parentWidth: args.width
                });
        }

        return deferred.promise;
    };

    this.validate = function (file) {
        var violations = [];
        if (file.files[0].size < self.getLowerbound()) violations.push('contentLength.lowerbound');
        if (file.files[0].size > self.getUpperbound()) violations.push('contentLength.upperbound');
        if (file.files[0].type.indexOf('image/') == -1) violations.push('contentType.whitelist');
        return violations;
    };

    this.upload = function (args) {
        var deferred = $q.defer();

        $timeout(function() {
            deferred.notify('uploading');
        }, 0);

        uploader.add(args.file, args.code, args.imageType);

        uploader.upload({
            success: function (payload) {
                $rootScope.image.uploaded[args.code] = new Date().getTime();
                deferred.resolve(payload);
            },
            rejected: function (reason) {
                deferred.reject(reason);
            }
        });

        return deferred.promise;
    };

    this.fileUpload = function (context) {
        return getFileUploadElement().fileupload(context);
    };

    this.triggerFileUpload = function () {
        getFileUploadElement().click();
    };

    function getFileUploadElement () {
        var body = angular.element(document.body);
        var input = body.find('#bin-image-file-upload');
        if (input.length != 1) {
            body.append('<input id="bin-image-file-upload" type="file" accept="image/*" class="hidden">');
            input = body.find('#bin-image-file-upload');
        }
        return input;
    }
}

function BinImageDirectiveFactory(imageManagement) {
    return {
        restrict: 'A',
        scope: true,
        controller: 'binImageController',
        link: function (scope, element, attrs) {
            scope.code = attrs.binImage;
            scope.bindImageEvents();
            if (attrs.readOnly == undefined) scope.bindClickEvent();

            scope.setDefaultImageSrc = function() {
                imageManagement.getImagePath({code: scope.code, width: getBoxWidth()}).then(function (path) {
                    element[0].src = path;
                });
            };
            scope.setDefaultImageSrc();

            scope.setImageSrc = function(src) {
                element[0].src = src;
            };

            function getBoxWidth () {
                var width = 0;
                var el = element;
                while (width == 0) {
                    el = el.parent();
                    width = el.width();
                }
                return width;
            }
        }
    }
}

function BinBackgroundImageDirectiveFactory(imageManagement) {
    return {
        restrict: 'A',
        scope: true,
        controller: 'binImageController',
        link: function (scope, element, attrs) {
            scope.code = attrs.binBackgroundImage;
            if (attrs.readOnly == undefined) scope.bindClickEvent();
            
            scope.setDefaultImageSrc = function() {
                imageManagement.getImagePath({code: scope.code, width: element.width()}).then(function (path) {
                    var bindElement = angular.element('<img>').attr('src', path);

                    scope.bindImageEvents({
                        bindOn: bindElement
                    }).then(function () {
                        element.css('background-image', 'url("' + path + '")');
                    }).finally(function () {
                        bindElement.remove();
                    });
                });
            };
            scope.setDefaultImageSrc();

            scope.setImageSrc = function(src) {
                element.css('background-image', 'url(' + src + ')');
            };
        }
    }
}

function BinImageController($scope, $element, $q, imageManagement, editModeRenderer, activeUserHasPermission, ngRegisterTopicHandler, $window) {
    $scope.state = 'working';

    $scope.bindImageEvents = function (args) {
        var deferred = $q.defer();
        var element = args && args.bindOn ? args.bindOn : $element;

        $element.addClass('working');
        element.bind('load', function () {
            imageLoaded();
        });
        element.bind('error', function () {
            imageNotFound();
        });
        element.bind('abort', function () {
            imageNotFound();
        });
        function imageLoaded() {
            $scope.state = 'loaded';
            $element.removeClass('not-found');
            $element.removeClass('working');
            deferred.resolve();
        }
        function imageNotFound() {
            $scope.state = 'not-found';
            $element.addClass('not-found');
            $element.removeClass('working');
            deferred.reject();
        }

        return deferred.promise;
    };

    $scope.bindClickEvent = function () {
        activeUserHasPermission({
            yes: function () {
                ngRegisterTopicHandler($scope, 'edit.mode', bindClickEvent);
            },
            no: function () {
                bindClickEvent(false);
            },
            scope: $scope
        }, 'image.upload');  
    };

    function bindClickEvent(editMode) {
        if (editMode) {
            $element.bind("click", function () {
                if ($scope.state != 'working') {
                    $scope.onEdit ? $scope.onEdit({isFirstImage: $scope.state == 'not-found'}) : open();
                }
                return false;
            });
        } else {
            $element.unbind("click");
        }
    }

    function isImgElement() {
        return $element.is('img');
    }

    function getImageType() {
        return isImgElement() ? 'foreground' : 'background';
    }

    function open() {
        imageManagement.fileUpload({
            dataType: 'json',
            add: function(e, d) {
                var rendererScope = angular.extend($scope.$new(), {
                    submit: function () {
                        $element.addClass('uploading');
                        imageManagement.upload({file: d, code: $scope.code, imageType:getImageType()}).then(function () {
                            $element.removeClass('uploading');
                            rendererScope.state = '';
                            $scope.setDefaultImageSrc();
                            editModeRenderer.close();
                            disposePreviewImage();
                        }, function (reason) {
                            $element.removeClass('uploading');
                            rendererScope.state = reason;
                        }, function (update) {
                            rendererScope.state = update;
                        });
                    },
                    close: function () {
                        $scope.setDefaultImageSrc();
                        editModeRenderer.close();
                        disposePreviewImage();
                    }
                });

                var violations = imageManagement.validate(d);

                if (violations.length == 0) {
                    if ($window.URL) {
                        disposePreviewImage();
                        $scope.previewImageUrl = $window.URL.createObjectURL(d.files[0]);
                        $scope.setImageSrc($scope.previewImageUrl);
                        rendererScope.state = 'preview';
                    } else {
                        rendererScope.submit();
                    }
                } else {
                    $scope.violation = violations[0];
                    rendererScope.state = '';
                }

                function disposePreviewImage () {
                    if ($scope.previewImageUrl && $window.URL) $window.URL.revokeObjectURL($scope.previewImageUrl);
                }

                function openEditModeMenu () {
                    editModeRenderer.open({
                        template: "<div id='bin-image-file-upload-dialog'>" +
                        "<form class='bin-menu-edit-body'>" +
                        "<p class='text-warning' ng-if='violation'>" +
                        "<i class='fa fa-times-circle fa-fw'></i>" +
                        "<span i18n code='upload.image.{{violation}}' default='{{violation}}' read-only>{{var}}</span>" +
                        "</p>" +
                        "<p ng-if='state == \"uploading\"' i18n code=\"upload.image.uploading\" default=\"Bezig met uploaden...\" read-only><i class='fa fa-spinner fa-spin fa-fw'></i> {{var}}</p>" +
                        "<p ng-if='state == \"preview\"' class='bin-image-preview' i18n code=\"upload.image.preview\" default=\"PREVIEW\" read-only><img ng-src=\"{{previewImageUrl}}\"><span>{{var}}</span></p>" +
                        "</form>" +
                        "<div class='bin-menu-edit-actions'>" +
                        "<button type='submit' class='btn btn-success' ng-click='submit()' ng-if='state == \"preview\"' i18n code='upload.image.save.button' default='Opslaan' read-only>{{var}}</button>" +
                        "<button type='reset' class='btn btn-default' ng-click='close()' i18n code='upload.image.cancel.button' default='Annuleren' read-only>{{var}}</button>" +
                        "</div></div>",
                        scope: rendererScope
                    });
                }

                rendererScope.$apply(openEditModeMenu());
            }
        }).click();
    }
}

function BinImagesController($rootScope, $q, rest, config, editModeRenderer, $templateCache, imageManagement) {
    var self = this;
    self.images = [];
    var totalAllowedImages = 10;
    var limit;

    this.init = function (args) {
        self.partition = args.partition;
        limit = args.limit || totalAllowedImages;

        getImages({limit: limit, offset: 0}).then(function () {
            if (self.images.length == 0) self.images.push({
                id: self.partition + '0',
                path: toImagePath(self.partition + '0')
            });
        });
    };

    this.open = function (args) {
        limit = totalAllowedImages - self.images.length;

        getImages({limit: limit, offset: self.images.length}).then(function () {
            var scope = $rootScope.$new();
            scope.images = self.images;
            scope.awsPath = config.awsPath;
            if (args && args.isFirstImage) scope.isFirstImage = args.isFirstImage;

            if (!scope.isFirstImage && self.images.length == 1 && self.images[0].entity != 'catalog-item') {
                addFirstImage().then(function (result) {
                    var image = result.data;
                    image.path = toImagePath(image.id);
                    self.images.splice(0, 1);
                    self.images.push(image);
                });
            }

            scope.addImage = function () {
                resetViolation();

                if (self.images.length < totalAllowedImages) {
                    imageManagement.fileUpload({
                        dataType: 'json',
                        add: function(e, d) {
                            addImage().then(function (item) {
                                var image = item.data;
                                var violations = imageManagement.validate(d);
                                if (violations.length == 0) {
                                    scope.uploading = true;

                                    imageManagement.upload({
                                        file: d,
                                        code: toImagePath(image.id),
                                        imageType: 'foreground'
                                    }).then(function () {
                                        if (scope.isFirstImage) {
                                            scope.isFirstImage = false;
                                            self.images.splice(0, 1);
                                        }
                                        image.path = toImagePath(image.id);
                                        self.images.push(image);
                                    }, function () {
                                        scope.deleteImage(image);
                                        scope.violations.push('upload.failed');
                                    }).finally(function () {
                                        scope.uploading = false;
                                    });
                                } else {
                                    scope.deleteImage(image);
                                    scope.violations = violations;
                                }
                            });
                        }
                    });
                    imageManagement.triggerFileUpload();
                } else {
                    scope.violations.push('images.upperbound');
                }
            };

            scope.openImage = function (image) {
                resetViolation();
                scope.openedImage = image;
            };

            scope.closeImage = function () {
                resetViolation();
                scope.openedImage = undefined;
            };

            scope.deleteImage = function (image) {
                resetViolation();
                if (self.images.length > 1) {
                    rest({
                        params: {
                            method: 'DELETE',
                            url: config.baseUri + 'api/entity/catalog-item?id=' + encodeURIComponent(image.id),
                            withCredentials: true
                        }
                    }).then(function () {
                        if (self.images.indexOf(image) != -1) self.images.splice(self.images.indexOf(image), 1);
                        scope.openedImage = undefined;
                    });
                } else {
                    scope.violations.push('images.lowerbound');
                }
            };

            scope.close = function () {
                editModeRenderer.close();
            };

            if (scope.isFirstImage) scope.addImage();

            editModeRenderer.open({
                template: $templateCache.get('images-bin-images-ctrl-clerk.html'),
                scope: scope
            });

            function resetViolation() {
                scope.violations = [];
            }
        });
    };

    function getImages(args) {
        var deferred = $q.defer();

        if (args.limit > 0) {
            rest({
                params: {
                    data: {
                        args: {
                            namespace: config.namespace,
                            partition: self.partition,
                            sortings: [{
                                on: "priority",
                                orientation: "asc"
                            }],
                            subset: {
                                count: args.limit,
                                offset: args.offset
                            },
                            type: "images"
                        },
                        locale: 'default'
                    },
                    headers: {
                        "accept-language": "default"
                    },
                    method: "POST",
                    url: config.baseUri + 'api/query/catalog-item/search',
                    withCredentials: true
                }
            }).then(function (results) {
                angular.forEach(results.data, function (image) {
                    image.path = toImagePath(image.id);
                    self.images.push(image)
                });
                deferred.resolve();
            });
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    }

    function addImage(firstImage) {
        var args = {
            params: {
                data: {
                    type: 'images',
                    partition: self.partition,
                    locale: 'default',
                    namespace: config.namespace,
                    defaultName: 'image'
                },
                method: 'PUT',
                url: (config.baseUri || '') + 'api/entity/catalog-item',
                withCredentials: true
            }
        };
        if (firstImage) args.params.data.name = '0';
        return rest(args);
    }

    function addFirstImage() {
        return addImage(true);
    }

    function toImagePath(id) {
        return 'carousels' + id + '.img';
    }
}

function ImageShowDirectiveFactory(config, topicRegistry, activeUserHasPermission, topicMessageDispatcher, $timeout, $rootScope, imagePathBuilder) {
    var componentsDir = config.componentsDir || 'bower_components';

    return {
        restrict: 'E',
        controller: ['$scope', 'uploader', 'config', '$rootScope', 'topicMessageDispatcher', 'imagePathBuilder', ImageController],
        templateUrl: componentsDir + '/binarta.images.angular/template/image-show.html',
        scope: {
            path: '@',
            link: '@',
            target: '@',
            alt: '@',
            imageClass: '@',
            width: '@',
            asBackgroundImage: '@'
        },
        link: function (scope, element, attrs, controller) {

            var placeholderImage = 'http://cdn.binarta.com/image/placeholder.png';

            topicMessageDispatcher.fire('image.loading', 'loading');

            $timeout(function () {
                if (scope.working != false) scope.working = true;
            }, 1000);

            var img = element.find('img').first();

            img.bind('load', function () {
                imageFound();
                topicMessageDispatcher.fire('image.loading', 'loaded');
            });

            img.bind('error', function () {
                imageNotFound();
                topicMessageDispatcher.fire('image.loading', 'error');
            });

            img.bind('abort', function () {
                imageNotFound();
                topicMessageDispatcher.fire('image.loading', 'abort');
            });

            function imageFound() {
                if (scope.imageSource != placeholderImage) {
                    scope.$apply(scope.notFound = false);
                    img.removeClass('not-found');
                }
                scope.$apply(scope.working = false);
                img.removeClass('working');
            }

            function imageNotFound() {
                scope.imageSource = placeholderImage;
                scope.$apply(scope.notFound = true);
                img.addClass('not-found');
            }

            scope.getBoxWidth = function () {
                return scope.width || element.parent().width();
            };

            function toImageSource() {
                return config.awsPath + imagePathBuilder({
                        cache: scope.cacheEnabled,
                        path: scope.path,
                        parentWidth: scope.getBoxWidth()
                    });
            }

            scope.$watch('cacheEnabled', function () {
                scope.imageSource = toImageSource();
            }, true);

            scope.$watch('link', function () {
                scope.linkProvided = scope.link != undefined;
            });
            scope.imgClass = attrs.class;
            scope.$watch('imageClass', function () {
                if (scope.imageClass) scope.imgClass = scope.imgClass ? attrs.class + ' ' + scope.imageClass : scope.imageClass;
            }, true);
            scope.editing = false;

            element.fileupload({
                dataType: 'text',
                add: function (e, data) {
                    e.value = data.files[0].name;
                    controller.add(data, scope.path);
                }
            });
            scope.open = function () {
                element.find("input[type='file']").click();
            };

            scope.updateBackgroundImage = function (path) {
                element.css('background-image', 'url("' + path + '")');
            };

            if(scope.asBackgroundImage) {
                scope.updateBackgroundImage(toImageSource());
            }

            var putCacheEnabledOnScope = function () {
                activeUserHasPermission({
                    no: function () {
                        scope.cacheEnabled = config.image && config.image.cache;
                    },
                    yes: function () {
                        scope.cacheEnabled = false;
                    }
                }, 'image.upload');
            };

            topicRegistry.subscribe('app.start', putCacheEnabledOnScope);

            var putEditingOnScope = function (editMode) {
                activeUserHasPermission({
                    no: function () {
                        scope.editing = false;
                    },
                    yes: function () {
                        scope.editing = editMode;
                    }
                }, 'image.upload');
            };

            topicRegistry.subscribe('edit.mode', putEditingOnScope);

            scope.$on('$destroy', function () {
                topicRegistry.unsubscribe('edit.mode', putEditingOnScope);
                topicRegistry.unsubscribe('app.start', putCacheEnabledOnScope);
            });
        }
    }
}

function ImageController($scope, uploader, config, $rootScope, topicMessageDispatcher, imagePathBuilder) {
    var init = function () {
        $scope.temp = [];
        $scope.selecting = false;
        $scope.hasError = false;
    };
    init();

    $scope.select = function () {
        $scope.selecting = true;
    };

    $scope.cancel = function () {
        $scope.selecting = false;
    };

    $scope.upload = function () {
        $scope.temp = [];
        $scope.loading = true;
        $scope.hasError = false;
        $scope.canUpload = false;
        uploader.upload({
            success: onSuccess,
            rejected: onRejected
        });
    };

    var onSuccess = function () {
        $rootScope.image.uploaded[uploader.path] = new Date().getTime();
        $scope.imageSource = config.awsPath + imagePathBuilder({
            cache: false,
            path: uploader.path,
            parentWidth: $scope.getBoxWidth()
        });
        $scope.loading = false;
        $scope.status = 201;
        $scope.name = '';
        $scope.selecting = false;
        if($scope.asBackgroundImage) $scope.updateBackgroundImage($scope.imageSource);
    };

    var onRejected = function (violations) {
        $scope.loading = false;
        $scope.status = 412;
        $scope.hasError = true;
        Object.keys(violations).forEach(function (key) {
            violations[key].forEach(function (violation) {
                topicMessageDispatcher.fire('system.warning', {
                    code: key + '.' + violation,
                    default: key + '.' + violation
                });
            });
        });
    };

    this.add = function (file, path) {
        var violations = validateContentLength(file);
        if (violations.contentLength.length > 0) onRejected(violations);
        else executeUpload(file, path);
    };
    function validateContentLength(file) {
        var violations = {contentLength:[]};
        if (file.files[0].size < getLowerbound()) violations.contentLength.push('lowerbound');
        if (file.files[0].size > getUpperbound()) violations.contentLength.push('upperbound');
        return violations;
    }

    function getLowerbound() {
        return getImageUploadConfig() && config.image.upload.lowerbound ? config.image.upload.lowerbound : 1024;
    }

    function getImageUploadConfig() {
        return config.image && config.image.upload;
    }

    function getUpperbound() {
        return getImageUploadConfig() && config.image.upload.upperbound ? config.image.upload.upperbound : 10485760;
    }

    function executeUpload(file, path) {
        uploader.add(file, path);
        $scope.name = file.files[0].name;
        $scope.canUpload = true;
        $scope.$apply();
        if (config.autoUpload) $scope.upload();
    }
}

function ImageUploadDialogController($scope, $modal, config) {
    var self = this;

    this.open = function (connector) {
        self.connector = connector;
        if (!$scope.imgSrc) $scope.imgSrc = 'images/redacted/' + uuid.v4() + '.img';
        $modal.open({
            templateUrl: 'partials/image/upload.modal.html',
            backdrop: 'static',
            scope: $scope
        });
    };

    this.source = function (src) {
        $scope.imgSrc = src.replace(config.awsPath, '').replace(/[#\?].*/, '');
    };

    $scope.accept = function () {
        self.connector.accept(config.awsPath + $scope.imgSrc + '?' + new Date().getTime());
    };
}

function ImagePathBuilderFactory($rootScope) {
    return function (args) {
        args.path = stripLeadingSlash(args.path);
        var path = args.parentWidth != undefined ? getSizedImage() : args.path;
        if (requiresTimestampedUrl()) path += getSeparator() + getTimeStamp();
        return path;

        function stripLeadingSlash(path) {
            return path.replace(/^\/+/, '');
        }

        function getSizedImage() {
            return args.path + '?width=' + convertParentWidthToRangedWidth()
        }

        function convertParentWidthToRangedWidth() {
            var width;
            [
                {lowerbound: 0, upperbound: 60, actual: 60},
                {lowerbound: 61, upperbound: 160, actual: 160},
                {lowerbound: 161, upperbound: 320, actual: 320},
                {lowerbound: 321, upperbound: 480, actual: 480},
                {lowerbound: 481, upperbound: 768, actual: 768},
                {lowerbound: 769, upperbound: 992, actual: 992},
                {lowerbound: 993, upperbound: 1200, actual: 1200},
                {lowerbound: 1201, upperbound: 1920, actual: 1920},
                {lowerbound: 1921, upperbound: 4096, actual: 4096}
            ].forEach(function (v) {
                    if (args.parentWidth >= v.lowerbound && args.parentWidth <= v.upperbound) {
                        width = v.actual;
                    }
                });
            return width || 1024;
        }

        function requiresTimestampedUrl() {
            return isCacheDisabled() || hasImageBeenUploaded();
        }

        function isCacheDisabled() {
            return !args.cache;
        }

        function hasImageBeenUploaded() {
            return $rootScope.image.uploaded[args.path];
        }

        function getSeparator() {
            return pathDoesNotContainQueryString() ? '?' : '&';
        }

        function pathDoesNotContainQueryString() {
            return path.indexOf('?') == -1;
        }

        function getTimeStamp() {
            return $rootScope.image.uploaded[args.path] || $rootScope.image.defaultTimeStamp;
        }
    }
}