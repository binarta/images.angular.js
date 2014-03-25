angular.module('image-management', [])
    .directive('imageShow', ['config', 'topicRegistry', 'activeUserHasPermission', 'topicMessageDispatcher', '$timeout', '$rootScope', ImageShowDirectiveFactory])
    .run(function($rootScope, $location, topicRegistry, topicMessageDispatcher){
        var imageCount = 0;

        $rootScope.$watch(function () {
            return $location.path();
        }, function () {
            imageCount = 0;
        });

        topicRegistry.subscribe('image.loading', function (topic) {
            if(topic == 'loading') {
                imageCount++;
            } else {
                if (imageCount > 0) reduceImageCount();
            }
        });

        function reduceImageCount() {
            imageCount--;
            if (imageCount == 0) topicMessageDispatcher.fire('images.loaded', 'ok');
        }
    });

function ImageShowDirectiveFactory(config, topicRegistry, activeUserHasPermission, topicMessageDispatcher, $timeout, $rootScope) {
    return {
        restrict: 'E',
        controller: ['$scope', 'uploader', 'config', ImageController],
        templateUrl: function() {
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
                if(scope.working != false) scope.working = true;
            }, 1000);

            element.find('img').first().bind('load', function() {
                if(scope.imageSource != placeholderImage) scope.$apply(scope.notFound = false);
                scope.$apply(scope.working = false);
                topicMessageDispatcher.fire('image.loading', 'loaded');
            });

            element.find('img').first().bind('error', function() {
                topicMessageDispatcher.fire('image.loading', 'error');
                imageNotFound();
            });

            element.find('img').first().bind('abort', function() {
                topicMessageDispatcher.fire('image.loading', 'abort');
                imageNotFound();
            });

            function imageNotFound() {
                scope.imageSource = placeholderImage;
                scope.$apply(scope.notFound = true);
            }

            scope.cacheEnabled = false;

            function toQueryString() {
                return scope.cacheEnabled ? '' : '?' + new Date().getTime();
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
            scope.$watch('imageClass', function() {
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

function ImageController($scope, uploader, config) {
    var init = function () {
        $scope.imageSource = config.awsPath;
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
        $scope.imageSource = config.awsPath + uploader.path + "?" + new Date().getTime();
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