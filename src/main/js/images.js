angular.module('image-management', ['ui.bootstrap.modal', 'config'])
    .service('imageManagement', ['$q', 'config', 'imagePathBuilder', 'activeUserHasPermission', 'uploader', '$rootScope', '$timeout', ImageManagementService])
    .directive('imageShow', ['config', 'topicRegistry', 'activeUserHasPermission', 'topicMessageDispatcher', '$timeout', '$rootScope', 'imagePathBuilder', ImageShowDirectiveFactory])
    .directive('binImage', ['imageManagement', 'activeUserHasPermission', 'ngRegisterTopicHandler', 'editModeRenderer', BinImageDirectiveFactory])
    .factory('imagePathBuilder', ['$rootScope', ImagePathBuilderFactory])
    .controller('ImageUploadDialogController', ['$scope', '$modal', 'config', ImageUploadDialogController])
    .controller('ImageController', ['$scope', 'uploader', 'config', '$rootScope', 'topicMessageDispatcher', 'imagePathBuilder', ImageController])
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
        if (file.files[0].size < self.getLowerbound()) violations.push('size.lowerbound');
        if (file.files[0].size > self.getUpperbound()) violations.push('size.upperbound');
        if (file.files[0].type.indexOf('image/') == -1) violations.push('type.invalid');
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
        var body = angular.element(document.body);
        var input = body.find('#bin-image-file-upload');
        if (input.length != 1) {
            body.append('<input id="bin-image-file-upload" type="file" accept="image/*" class="hidden">');
            input = body.find('#bin-image-file-upload');
        }
        return input.fileupload(context);
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

function BinImageDirectiveFactory(imageManagement, activeUserHasPermission, ngRegisterTopicHandler, editModeRenderer) {
    return {
        restrict: 'A',
        scope: true,
        link: function (scope, element, attrs) {
            function setDefaultImageSrc() {
                imageManagement.getImagePath({code: attrs.binImage, width: getBoxWidth()}).then(function (path) {
                    element[0].src = path;
                });
            }
            setDefaultImageSrc();

            function setImageSrc(src) {
                element[0].src = src;
            }

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

            function getBoxWidth () {
                return attrs.width || element.parent().width();
            }

            function bindClickEvent(editMode) {
                if (editMode) {
                    element.bind("click", function () {
                        open();
                    });
                } else {
                    element.unbind("click");
                    setDefaultImageSrc();
                }
            }

            activeUserHasPermission({
                yes: function () {
                    ngRegisterTopicHandler(scope, 'edit.mode', bindClickEvent);
                },
                no: function () {
                    bindClickEvent(false);
                },
                scope: scope
            }, 'image.upload');

            function open() {
                var data;
                function init() {
                    scope.violations = [];
                    scope.state = '';
                }
                init();

                imageManagement.fileUpload({
                    dataType: 'json',
                    add: function(e, d) {
                        editModeRenderer.open({
                            template: "<div id='bin-image-file-upload-dialog'>" +
                            "<form>" +
                            "<p class='text-warning' ng-repeat='v in violations'>" +
                            "<i class='fa fa-times-circle fa-fw'></i>" +
                            "<span ng-switch on='v'>" +
                            "<span ng-switch-when='size.upperbound'> De foto mag maximum 10MB groot zijn.</span>" +
                            "<span ng-switch-when='size.lowerbound'> De foto moet minimum 1kB groot zijn.</span>" +
                            "<span ng-switch-when='type.invalid'> Ongeldige foto.</span>" +
                            "<span ng-switch-default> {{v}}</span>" +
                            "</span>" +
                            "</p>" +
                            "<p ng-if='state == \"uploading\"'><i class='fa fa-spinner fa-spin fa-fw'></i> Bezig met uploaden...</p>" +
                            "<p ng-if='state == \"preview\"'><i class='fa fa-spinner fa-spin fa-fw'></i> Voorbeeld wordt geladen...</p>" +
                            "</form>" +
                            "<div class='dropdown-menu-buttons'>" +
                            "<button type='submit' class='btn btn-success' ng-click='submit()' ng-if='state == \"ok\"'>Opslaan</button>" +
                            "<button type='reset' class='btn btn-default' ng-click='close()'>Annuleren</button>" +
                            "</div></div>",
                            scope: scope
                        });
                        scope.$apply(scope.state = 'preview');
                        scope.violations = imageManagement.validate(d);

                        if (scope.violations.length == 0) {
                            var reader = new FileReader();
                            reader.onload = function (e) {
                                setImageSrc(e.target.result);
                                scope.$apply(scope.state = 'ok');
                            };
                            reader.readAsDataURL(d.files[0]);
                        } else {
                            scope.$apply(scope.state = '');
                        }

                        data = d;
                    }
                }).click();

                scope.submit = function () {
                    element.addClass('uploading');
                    imageManagement.upload({file: data, code: attrs.binImage}).then(function () {
                        element.removeClass('uploading');
                        scope.state = '';
                        setDefaultImageSrc();
                        editModeRenderer.close();
                    }, function (reason) {
                        element.removeClass('uploading');
                        scope.state = reason;
                    }, function (update) {
                        scope.state = update;
                    });
                };

                scope.close = function () {
                    setDefaultImageSrc();
                    editModeRenderer.close();
                };
            }
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
                {lowerbound: 0, upperbound: 68, actual: 60},
                {lowerbound: 69, upperbound: 195, actual: 160},
                {lowerbound: 196, upperbound: 419, actual: 320},
                {lowerbound: 420, upperbound: 543, actual: 480},
                {lowerbound: 544, upperbound: 767, actual: 640},
                {lowerbound: 768, upperbound: 991, actual: 800}
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