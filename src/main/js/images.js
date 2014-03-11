angular.module('image-management', [])
    .directive('imageShow', ['config', 'topicRegistry', 'activeUserHasPermission', 'topicMessageDispatcher', '$timeout', ImageShowDirectiveFactory])
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

function ImageShowDirectiveFactory(config, topicRegistry, activeUserHasPermission, topicMessageDispatcher, $timeout) {
    return {
        restrict: 'E',
        controller: ['$scope', 'uploader', 'config', '$templateCache', ImageController],
        templateUrl: 'app/partials/image/show.html',
        scope: {
            path: '@',
            link: '@',
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

            topicRegistry.subscribe('app.start', function () {
                activeUserHasPermission({
                    no: function () {
                        scope.cacheEnabled = config.image && config.image.cache;
                    },
                    yes: function () {
                        scope.cacheEnabled = false;
                    }
                }, 'image.upload');
            });

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

            topicRegistry.subscribe('edit.mode', function (editMode) {
                activeUserHasPermission({
                    no: function () {
                        scope.editing = false;
                    },
                    yes: function () {
                        scope.editing = editMode;
                    }
                }, 'image.upload');
            });

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
        }
    }
}

function ImageController($scope, uploader, config) {
    var init = function () {
        $scope.imageSource = config.awsPath;
        $scope.temp = [];
        $scope.selecting = false;
        $scope.hasError = false;
    }
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
        })
        return list
    }

    var onSuccess = function () {
//        $templateCache.removeAll();
        $scope.imageSource = config.awsPath + uploader.path + "?" + new Date().getTime();
        $scope.loading = false;
        $scope.status = 201;
        $scope.name = '';
    }

    var onError = function () {
        $scope.loading = false;
        $scope.status = 500;
        $scope.error = 'Error communicating with filestore';
    }

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