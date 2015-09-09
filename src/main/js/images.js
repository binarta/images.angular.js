angular.module('image-management', ['config', 'checkpoint', 'image.rest', 'notifications', 'ui.bootstrap.modal', 'toggle.edit.mode'])
    .service('imageManagement', ['$q', 'config', 'imagePathBuilder', 'activeUserHasPermission', 'uploader', '$rootScope', '$timeout', ImageManagementService])
    .directive('imageShow', ['config', 'topicRegistry', 'activeUserHasPermission', 'topicMessageDispatcher', '$timeout', '$rootScope', 'imagePathBuilder', ImageShowDirectiveFactory])
    .directive('binImage', ['imageManagement', BinImageDirectiveFactory])
    .directive('binBackgroundImage', ['imageManagement', BinBackgroundImageDirectiveFactory])
    .factory('imagePathBuilder', ['$rootScope', ImagePathBuilderFactory])
    .controller('ImageUploadDialogController', ['$scope', '$modal', 'config', ImageUploadDialogController])
    .controller('ImageController', ['$scope', 'uploader', 'config', '$rootScope', 'topicMessageDispatcher', 'imagePathBuilder', ImageController])
    .controller('binImageController', ['$scope', 'imageManagement', 'editModeRenderer', 'activeUserHasPermission', 'ngRegisterTopicHandler', '$window', BinImageController])
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

        uploader.add(args.file, args.code);

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
            element.addClass('working');
            element.bind('load', function () {
                imageFound();
            });
            element.bind('error', function () {
                imageNotFound();
            });
            element.bind('abort', function () {
                imageNotFound();
            });
            function imageFound() {
                element.removeClass('not-found');
                element.removeClass('working');
            }
            function imageNotFound() {
                element.addClass('not-found');
                element.removeClass('working');
            }

            scope.code = attrs.binImage;
            scope.init(element);

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
            scope.init(element);

            scope.setDefaultImageSrc = function() {
                imageManagement.getImagePath({code: scope.code, width: element.width()}).then(function (path) {
                    element.css('background-image', 'url("' + path + '")');
                });
            };
            scope.setDefaultImageSrc();

            scope.setImageSrc = function(src) {
                element.css('background-image', 'url(' + src + ')');
            };
        }
    }
}

function BinImageController($scope, imageManagement, editModeRenderer, activeUserHasPermission, ngRegisterTopicHandler, $window) {
    var element;

    $scope.init = function (el) {
        element = el;
    };

    activeUserHasPermission({
        yes: function () {
            ngRegisterTopicHandler($scope, 'edit.mode', bindClickEvent);
        },
        no: function () {
            bindClickEvent(false);
        },
        scope: $scope
    }, 'image.upload');

    function bindClickEvent(editMode) {
        if (editMode) {
            element.bind("click", function () {
                open();
                return false;
            });
        } else {
            element.unbind("click");
            $scope.setDefaultImageSrc();
        }
    }

    function open() {
        imageManagement.fileUpload({
            dataType: 'json',
            add: function(e, d) {
                var rendererScope = angular.extend($scope.$new(), {
                    submit: function () {
                        element.addClass('uploading');
                        imageManagement.upload({file: d, code: $scope.code}).then(function () {
                            element.removeClass('uploading');
                            rendererScope.state = '';
                            $scope.setDefaultImageSrc();
                            editModeRenderer.close();
                            disposePreviewImage();
                        }, function (reason) {
                            element.removeClass('uploading');
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
        var path = args.parentWidth != undefined ? getSizedImage() : args.path;
        if (requiresTimestampedUrl()) path += getSeparator() + getTimeStamp();
        return path;

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