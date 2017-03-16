angular.module('image-management', ['config', 'image.rest', 'notifications', 'toggle.edit.mode', 'binarta-checkpointjs-angular1', 'image-management.templates'])
    .service('imageManagement', ['$q', 'config', 'uploader', '$timeout', 'binarta', '$log', ImageManagementService])
    .directive('binImage', ['$timeout', 'imageManagement', BinImageDirectiveFactory])
    .directive('binBackgroundImage', ['$timeout', 'imageManagement', BinBackgroundImageDirectiveFactory])
    .component('binImageEnlarged', new BinImageEnlargedComponent())
    .component('binImageUploader', new BinImageUploader)
    .component('binIcon', new BinIconComponent())
    .controller('binImageController', ['$scope', '$element', 'imageManagement', 'editModeRenderer', 'binarta', 'ngRegisterTopicHandler', '$window', BinImageController]);

function ImageManagementService($q, config, uploader, $timeout, binarta, $log) {
    var self = this, uploadCallbacks = [];

    this.image = {
        uploaded: [],
        defaultTimeStamp: new Date().getTime(),
        minWidth: 60
    };

    this.getLowerbound = function () {
        return config.image && config.image.upload && config.image.upload.lowerbound ? config.image.upload.lowerbound : 1024;
    };

    this.getUpperbound = function () {
        return config.image && config.image.upload && config.image.upload.upperbound ? config.image.upload.upperbound : 10485760;
    };

    this.getImageUrl = function (args) {
        return config.awsPath + getImagePath({code: args.code, width: args.width, height: args.height});
    };

    this.getImagePath = function (args) {
        $log.warn('@deprecated ImageManagementService.getImagePath - use getImageUrl instead!');
        var deferred = $q.defer();
        deferred.resolve(self.getImageUrl(args));
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

        if (isUploadPermitted()) {
            $timeout(function () {
                deferred.notify('uploading');
            }, 0);

            uploader.add(args.file, args.code, args.imageType, args.carouselImage);

            uploader.upload({
                success: function (payload) {
                    self.image.uploaded[args.code] = new Date().getTime();
                    executeUploadCallbacks(args.code);
                    deferred.resolve(payload);
                },
                rejected: function () {
                    deferred.reject('upload.failed');
                }
            });
        } else {
            deferred.reject('unauthorized');
        }

        return deferred.promise;
    };

    this.fileUpload = function (context) {
        return getFileUploadElement().fileupload(context);
    };

    this.triggerFileUpload = function () {
        getFileUploadElement().click();
    };

    this.onUploaded = function (cb) {
        uploadCallbacks.push(cb);
        return function () {
            uploadCallbacks.splice(uploadCallbacks.indexOf(cb), 1);
        };
    };

    function executeUploadCallbacks(code) {
        angular.forEach(uploadCallbacks, function (cb) {
            cb(code);
        });
    }

    function getImagePath(args) {
        var path = args.code;
        if (args.width != undefined) {
            var width = args.height != undefined ? args.width : convertToRangedWidth(args.width);
            path += getSeparator(path);
            path += getWidthQueryString(width);
        }
        if (args.height != undefined) {
            path += getSeparator(path);
            path += getHeightQueryString(args.height);
        }
        if (requiresTimestampedUrl(args.code)) {
            path += getSeparator(path);
            path += getTimeStamp(args.code);
        }
        return path;
    }

    function getWidthQueryString(width) {
        return 'width=' + width;
    }

    function getHeightQueryString(height) {
        return 'height=' + height;
    }

    function convertToRangedWidth(width) {
        var w;
        [
            {lowerbound: 0, upperbound: 60, actual: self.image.minWidth},
            {lowerbound: 61, upperbound: 160, actual: 160},
            {lowerbound: 161, upperbound: 320, actual: 320},
            {lowerbound: 321, upperbound: 480, actual: 480},
            {lowerbound: 481, upperbound: 768, actual: 768},
            {lowerbound: 769, upperbound: 992, actual: 992},
            {lowerbound: 993, upperbound: 1200, actual: 1200},
            {lowerbound: 1201, upperbound: 1920, actual: 1920},
            {lowerbound: 1921, upperbound: 4096, actual: 4096}
        ].forEach(function (v) {
            if (width >= v.lowerbound && width <= v.upperbound) {
                w = v.actual;
            }
        });
        return w || 1024;
    }

    function requiresTimestampedUrl(code) {
        return !isCacheEnabled() || hasImageBeenUploaded(code);
    }

    function getSeparator(path) {
        return pathDoesNotContainQueryString(path) ? '?' : '&';
    }

    function pathDoesNotContainQueryString(path) {
        return path.indexOf('?') == -1;
    }

    function isCacheEnabled() {
        return isUploadPermitted() ? false : config.image && config.image.cache;
    }

    function isUploadPermitted() {
        return binarta.checkpoint.profile.hasPermission('image.upload');
    }

    function hasImageBeenUploaded(code) {
        return self.image.uploaded[code];
    }

    function getTimeStamp(code) {
        return self.image.uploaded[code] || self.image.defaultTimeStamp;
    }

    function getFileUploadElement() {
        var body = angular.element(document.body);
        var input = body.find('#bin-image-file-upload');
        if (input.length != 1) {
            body.append('<input id="bin-image-file-upload" type="file" accept="image/*" class="hidden">');
            input = body.find('#bin-image-file-upload');
        }
        return input;
    }
}

function BinImageDirectiveFactory($timeout, imageManagement) {
    return {
        restrict: 'A',
        scope: true,
        controller: 'binImageController',
        link: function (scope, element, attrs) {
            scope.code = attrs.binImage.replace(/^\/+/, '');
            scope.bindImageEvents();
            if (attrs.readOnly == undefined) scope.bindClickEvent();

            scope.setImageSrc = function (src) {
                scope.src = src;
                element[0].src = src;
            };

            scope.setDefaultImageSrc = function () {
                var args = {code: scope.code};
                if (attrs.height) {
                    args.height = parseInt(attrs.height);
                    if (attrs.width) args.width = parseInt(attrs.width);
                }
                else args.width = parseInt(attrs.width) || getBoxWidth();
                scope.setImageSrc(imageManagement.getImageUrl(args));
            };

            $timeout(function () {
                scope.setDefaultImageSrc();
            });

            function getBoxWidth() {
                var width = 0;
                var el = element;
                while (width < imageManagement.image.minWidth) {
                    if (el.parent) {
                        el = el.parent();
                        width = el.width();
                    } else width = imageManagement.image.minWidth;
                }
                return width;
            }
        }
    }
}

function BinBackgroundImageDirectiveFactory($timeout, imageManagement) {
    return {
        restrict: 'A',
        scope: true,
        controller: 'binImageController',
        link: function (scope, element, attrs) {
            scope.code = attrs.binBackgroundImage.replace(/^\/+/, '');
            if (attrs.readOnly == undefined) scope.bindClickEvent();

            scope.setImageSrc = function (src) {
                scope.src = src;
                element.css('background-image', 'url("' + src + '")');
            };

            scope.setDefaultImageSrc = function () {
                var path = imageManagement.getImageUrl({code: scope.code, width: element.width()});
                scope.setImageSrc(path);
            };

            $timeout(function () {
                scope.setDefaultImageSrc();
            });
        }
    }
}

function BinImageController($scope, $element, imageManagement, editModeRenderer, binarta, ngRegisterTopicHandler, $window) {
    var fallbackSrc = '//cdn.binarta.com/image/icons/camera-faded.svg';

    $scope.bindImageEvents = function (args) {
        var element = args && args.bindOn ? args.bindOn : $element;

        element.bind('load', imageLoaded);
        element.bind('error', imageNotFound);
        element.bind('abort', imageNotFound);

        function imageLoaded() {
            if ($scope.src != fallbackSrc) $element.removeClass('not-found');
        }

        function imageNotFound() {
            $element.addClass('not-found');
            $scope.setImageSrc(fallbackSrc);
        }
    };

    $scope.bindClickEvent = function () {
        var listeningToEditModeEvents = false;
        var listener = {
            signedin: function () {
                if (binarta.checkpoint.profile.hasPermission('image.upload')) {
                    if (!listeningToEditModeEvents) {
                        listeningToEditModeEvents = true;
                        ngRegisterTopicHandler($scope, 'edit.mode', bindClickEvent);
                    }
                } else
                    bindClickEvent(false);
            },
            signedout: function () {
                bindClickEvent(false);
            }
        };
        binarta.checkpoint.profile.eventRegistry.add(listener);
        listener.signedin();
        $scope.$on('$destroy', function () {
            binarta.checkpoint.profile.eventRegistry.remove(listener);
        });
    };

    var unsubscribeOnUploadedListener = imageManagement.onUploaded(function (code) {
        if (code == $scope.code) $scope.setDefaultImageSrc();
    });

    function bindClickEvent(editMode) {
        if (editMode) {
            $element.bind("click", function () {
                open();
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
            add: function (e, d) {
                var rendererScope = angular.extend($scope.$new(), {
                    submit: function () {
                        $element.addClass('uploading');
                        imageManagement.upload({
                            file: d,
                            code: $scope.code,
                            imageType: getImageType()
                        }).then(function () {
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

                function disposePreviewImage() {
                    if ($scope.previewImageUrl && $window.URL) $window.URL.revokeObjectURL($scope.previewImageUrl);
                }

                function openEditModeMenu() {
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

    $scope.$on('$destroy', function () {
        unsubscribeOnUploadedListener();
    });
}

function BinImageEnlargedComponent() {
    this.template = '<a ng-href="{{::$ctrl.url}}"><img bin-image="{{::$ctrl.code}}"/></a>';
    this.bindings = {
        code: '@'
    };
    this.controller = ['imageManagement', '$element', function (imageManagement, $element) {
        this.url = imageManagement.getImageUrl({code: this.code});
        $element.find('a').magnificPopup({
            type: 'image',
            closeOnContentClick: true,
            image: {
                verticalFit: true
            }
        });
    }];
}

function BinImageUploader() {
    this.templateUrl = 'bin-image-uploader.html';
    this.bindings = {
        imageCode: '@',
        imageHeight: '@',
        i18nHelpCode: '@',
        onUpload: '&?'
    };
    this.controller = ['$scope', 'imageManagement', function ($scope, imageManagement) {
        var $ctrl = this;

        $ctrl.$onInit = function () {
            $ctrl.upload = function () {
                imageManagement.fileUpload({dataType: 'json', add: fileSelection}).click();
            };

            function fileSelection(e, file) {
                $ctrl.violations = imageManagement.validate(file);

                if ($ctrl.violations.length <= 0) {
                    $ctrl.working = true;
                    imageManagement.upload({
                        file: file,
                        code: $ctrl.imageCode,
                        imageType: 'foreground'
                    }).then(function () {
                        if ($ctrl.onUpload) $ctrl.onUpload();
                    }, function (reason) {
                        $ctrl.violations = [reason];
                    }).finally(function () {
                        $ctrl.working = false;
                    });
                }
                $scope.$apply();
            }
        };
    }];
}

function BinIconComponent() {
    this.bindings = {
        code: '@',
        value: '@',
        default: '@',
        height: '@',
        link: '<?',
        linkTarget: '<?',
        onUpdate: '&?'
    };

    this.templateUrl = 'bin-icon.html';

    this.controller = ['editMode', 'editModeRenderer', '$scope', '$element', 'binarta', 'configWriter',
        function (editMode, editModeRenderer, $scope, $element, binarta, configWriter) {
            var $ctrl = this, code;

            $ctrl.$onInit = function () {
                code = 'icons' + $ctrl.code;

                editMode.bindEvent({
                    scope: $scope,
                    element: $element,
                    permission: 'edit.mode',
                    onClick: onEdit
                });

                if (shouldUsePublicConfig()) {
                    binarta.schedule(function () {
                        binarta.application.config.findPublic(code, function (configValue) {
                            if (!configValue) setDefaultIconValue();
                            else $ctrl.iconValue = configValue;
                        });
                    });
                } else $ctrl.iconValue = $ctrl.value;
            };

            function shouldUsePublicConfig() {
                return angular.isUndefined($ctrl.value) || $ctrl.value == '' || !$ctrl.onUpdate;
            }

            function isImage() {
                return $ctrl.iconValue == 'image';
            }

            function setDefaultIconValue() {
                $ctrl.iconValue = $ctrl.default;
            }

            function updateValue(args) {
                if ($ctrl.iconValue == args.value) onSuccess();
                else {
                    if ($ctrl.onUpdate)
                        $ctrl.onUpdate({
                            request: {key: 'icon', value: args.value},
                            response: {success: onSuccess, error: onError}
                        });
                    else
                        configWriter({scope: 'public', key: code, value: args.value}).then(onSuccess, onError);
                }

                function onSuccess() {
                    $ctrl.iconValue = args.value;
                    if (args.success) args.success();
                }

                function onError() {
                    $ctrl.violations = ['update.failed'];
                }
            }

            function onEdit() {
                var rendererScope = $scope.$new();
                rendererScope.cancel = editModeRenderer.close;
                rendererScope.state = isImage() && isUploadPermitted() ? new ImageState() : new IconState();

                rendererScope.submit = function () {
                    rendererScope.state.submit();
                };

                rendererScope.changeView = function () {
                    rendererScope.state.changeView();
                };

                function IconState() {
                    var state = this;
                    this.name = 'icon';
                    this.icon = $ctrl.iconValue == 'image' ? '' : $ctrl.iconValue;
                    this.isUploadPermitted = isUploadPermitted();

                    this.submit = function () {
                        updateValue({value: this.icon, success: rendererScope.cancel});
                    };

                    this.changeView = function () {
                        if (isUploadPermitted()) rendererScope.state = new ImageState();
                    };
                }

                function ImageState() {
                    this.name = 'image';

                    this.submit = function () {
                        updateValue({value: 'image', success: rendererScope.cancel});
                    };

                    this.changeView = function () {
                        rendererScope.state = new IconState();
                    };
                }

                function isUploadPermitted() {
                    return binarta.checkpoint.profile.hasPermission('icon.upload');
                }

                editModeRenderer.open({
                    templateUrl: 'bin-icon-edit.html',
                    scope: rendererScope
                });
            }
        }
    ];
}
