angular.module('image-management', ['ui.bootstrap.modal'])
    .directive('imageShow', ['config', 'topicRegistry', 'activeUserHasPermission', 'topicMessageDispatcher', '$timeout', '$rootScope', ImageShowDirectiveFactory])
    .controller('ImageUploadDialogController', ['$scope', '$modal', ImageUploadDialogController])
    .run(function ($rootScope, $location, topicRegistry, topicMessageDispatcher) {
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
    });

function ImageShowDirectiveFactory(config, topicRegistry, activeUserHasPermission, topicMessageDispatcher, $timeout, $rootScope) {
    return {
        restrict: 'E',
        controller: ['$scope', 'uploader', 'config', '$rootScope', ImageController],
        templateUrl: function () {
            return $rootScope.imageShowTemplateUrl ? $rootScope.imageShowTemplateUrl : 'app/partials/image/show.html';
        },
        scope: {
            path: '@',
            link: '@',
            target: '@',
            alt: '@',
            imageClass: '@'
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

            scope.cacheEnabled = false;

            function getTimeStamp() {
                var img = $rootScope.image;
                return img.uploaded[scope.path] ? img.uploaded[scope.path] : img.defaultTimeStamp;
            }

            function toQueryString() {
                if (!scope.cacheEnabled || $rootScope.image.uploaded[scope.path])
                    return '?' + getTimeStamp();
                return '';
            }

            function toUri() {
                return config.awsPath + scope.path;
            }

            function toImageSource() {
                return toUri() + toQueryString();
            }

            scope.$watch('path', function () {
                scope.imageSource = toImageSource();
            }, true);
            scope.$watch('link', function () {
                scope.linkProvided = scope.link != undefined;
            });
            scope.imgClass = attrs.class;
            scope.$watch('imageClass', function () {
                scope.imgClass = scope.imgClass ? attrs.class + ' ' + scope.imageClass : scope.imageClass;
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

function ImageController($scope, uploader, config, $rootScope) {
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
        $scope.error = {};
        $scope.canUpload = false;
        uploader.upload({
            success: onSuccess,
            error: onError,
            rejected: onRejected
        });
    };

    $scope.toViolationList = function () {
        var list = [];
        Object.keys($scope.error).forEach(function (key) {
            $scope.error[key].forEach(function (violation) {
                list.push({'key': key, 'violation': violation})
            })
        });
        return list
    };

    var onSuccess = function () {
        var newTimeStamp = new Date().getTime();
        $rootScope.image.uploaded[uploader.path] = newTimeStamp;
        $scope.imageSource = config.awsPath + uploader.path + "?" + newTimeStamp;
        $scope.loading = false;
        $scope.status = 201;
        $scope.name = '';
        $scope.selecting = false;
    };

    var onError = function () {
        $scope.loading = false;
        $scope.status = 500;
        $scope.error = 'Error communicating with filestore';
    };

    var onRejected = function (violations) {
        $scope.loading = false;
        $scope.status = 412;
        $scope.hasError = true;
        $scope.error = violations;
        $scope.violationList = $scope.toViolationList();
    };

    this.add = function (file, path) {
        uploader.add(file, path);
        $scope.name = file.files[0].name;
        $scope.canUpload = true;
        $scope.$apply();
    }
}

function ImageUploadDialogController($scope, $modal) {
    var self = this;

    this.open = function (connector) {
        self.connector = connector;
        $modal.open({
            template: 'partials/image/upload.modal.html',
            backdrop: 'static',
            scope: $scope
        });
    };

    this.source = function (src) {
        $scope.imgSrc = src;
    };

    $scope.accept = function () {
        self.connector.accept($scope.imgSrc);
    };

    $scope.imgSrc = 'images/redacted/' + uuid.v4() + '.img';
}