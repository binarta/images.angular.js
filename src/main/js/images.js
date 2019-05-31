angular.module('image-management', ['config', 'image.rest', 'notifications', 'toggle.edit.mode', 'binarta-mediajs-angular1', 'image-management.templates'])
    .service('imageManagement', ['$q', 'config', 'uploader', '$timeout', 'binarta', '$log', ImageManagementService])
    .directive('binImage', ['$timeout', 'imageManagement', 'binarta', BinImageDirectiveFactory])
    .directive('binBackgroundImage', ['$timeout', 'imageManagement', 'binarta', BinBackgroundImageDirectiveFactory])
    .directive('binImagePopup', ['binarta', 'imageManagement', BinImagePopupDirective])
    .component('binImageEnlarged', new BinImageEnlargedComponent())
    .component('binImageUploader', new BinImageUploader)
    .component('binIcon', new BinIconComponent())
    .controller('binImageController', ['$scope', '$element', 'imageManagement', 'editModeRenderer', 'binarta', 'ngRegisterTopicHandler', '$window', BinImageController]);

function ImageManagementService($q, config, uploader, $timeout, binarta, $log) {
    var self = this, uploadCallbacks = [];
    var adhesiveReadingListener = new AdhesiveReadingListener();
    binarta.application.adhesiveReading.eventRegistry.add(adhesiveReadingListener);

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
        return binarta.media.images.toRelativeURL({path: args.code, width: args.width, height: args.height});
    };

    this.getImagePath = function (args) {
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
                    binarta.media.images.resetTimestamp();
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

    this.schedule = adhesiveReadingListener.schedule;

    function executeUploadCallbacks(code) {
        angular.forEach(uploadCallbacks, function (cb) {
            cb(code);
        });
    }

    function isUploadPermitted() {
        return binarta.checkpoint.profile.hasPermission('image.upload');
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

    function AdhesiveReadingListener() {
        var self = this;

        var jobs = [];
        var started;

        self.start = function () {
            started = true;
        };

        self.stop = function () {
            started = false;
            jobs.forEach(function (it) {
                it();
            });
            jobs = [];
        };

        self.schedule = function (job) {
            if (!started)
                job();
            else
                jobs.push(job);
        }
    }
}

function BinImageDirectiveFactory($timeout, imageManagement, binarta) {
    return {
        restrict: 'A',
        scope: {
            onNotFound: '&binImageOnNotFound'
        },
        controller: 'binImageController',
        require: '?^^binImageCarousel',
        link: function (scope, element, attrs, carouselCtrl) {
            scope.code = attrs.binImage.replace(/^\/+/, '');
            scope.bindImageEvents();
            if (attrs.readOnly == undefined) scope.bindClickEvent(carouselCtrl);
            element[0].src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

            scope.setImageSrc = function (src, src2x) {
                scope.src = src;
                if (shouldRenderAsCover() && !isObjectFitCoverSupported()) {
                    element.css('background-image', 'url("' + src + '")');
                } else {
                    element[0].src = src;
                    if (src2x) element[0].srcset = src2x + ' 2x';
                    else element[0].removeAttribute('srcset');
                }
            };

            function shouldRenderAsCover() {
                return element.hasClass('cover');
            }

            function isObjectFitCoverSupported() {
                if (!window.CSS) window.CSS = {};
                if (!window.CSS.supports) window.CSS.supports = function () {
                    return false;
                };
                return window.CSS.supports('object-fit', 'cover');
            }

            scope.setDefaultImageSrc = function () {
                var args = {code: scope.code};
                if (attrs.height) {
                    element.css({maxHeight: attrs.height + 'px'});
                    args.height = parseInt(attrs.height);
                    if (attrs.width) args.width = parseInt(attrs.width);
                }
                else {
                    args.width = parseInt(attrs.width) || getBoxWidth();
                    if (args.width == 0) return;
                }

                var args2x = {code: args.code};
                if (args.height) args2x.height = parseInt(args.height * 2);
                if (args.width) args2x.width = parseInt(args.width * 2);
                scope.setImageSrc(imageManagement.getImageUrl(args), imageManagement.getImageUrl(args2x));
            };

            $timeout(function () {
                binarta.schedule(function() {
                    imageManagement.schedule(scope.setDefaultImageSrc);
                });
            });

            function getBoxWidth() {
                var width = 0;
                var el = element;
                while (width < imageManagement.image.minWidth && isInteger(width)) {
                    if (el.parent) {
                        el = el.parent();
                        width = el.width();
                    } else width = imageManagement.image.minWidth;
                }
                return width || 0;
            }

            function isInteger(value) {
                return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
            }
        }
    }
}

function BinBackgroundImageDirectiveFactory($timeout, imageManagement, binarta) {
    return {
        restrict: 'A',
        scope: true,
        controller: 'binImageController',
        require: '?^^binImageCarousel',
        link: function (scope, element, attrs, carouselCtrl) {
            scope.code = attrs.binBackgroundImage.replace(/^\/+/, '');
            if (attrs.readOnly == undefined) scope.bindClickEvent(carouselCtrl);

            scope.setImageSrc = function (src) {
                scope.src = src;
                element.css('background-image', 'url("' + src + '")');
            };

            scope.setDefaultImageSrc = function () {
                var path = imageManagement.getImageUrl({code: scope.code, width: getWidth()});
                scope.setImageSrc(path);
            };

            $timeout(function () {
                binarta.schedule(function() {
                    imageManagement.schedule(scope.setDefaultImageSrc);
                });
            });

            function getWidth() {
                return attrs.width ? parseInt(attrs.width) : element.width();
            }
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
            if ($scope.onNotFound !== undefined) 
                $scope.onNotFound();
        }
    };

    $scope.bindClickEvent = function (carouselCtrl) {
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

        function bindClickEvent(editMode) {
            if (editMode) {
                $element.bind("click", function () {
                    carouselCtrl && carouselCtrl.edit ? $scope.$apply(carouselCtrl.edit()) : open();
                    return false;
                });
            } else {
                $element.unbind("click");
            }
        }
    };

    var unsubscribeOnUploadedListener = imageManagement.onUploaded(function (code) {
        if (code == $scope.code) $scope.setDefaultImageSrc();
    });

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
                $scope.violation = undefined;
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
                        templateUrl: "bin-image-edit.html",
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

function BinImagePopupDirective(binarta, imageManagement) {
    return {
        restrict: 'A',
        link: function (scope, el, attrs) {
            if (el[0].nodeName === 'A') {
                binarta.schedule(function() {
                    el[0].href = imageManagement.getImageUrl({code: attrs.binImagePopup});

                    el.magnificPopup({
                        type: 'image',
                        closeOnContentClick: true,
                        image: {
                            verticalFit: true
                        }
                    });
                });
            }
        }
    };
}

function BinImageEnlargedComponent() {
    this.template = '<a ng-class="{\'maintain-aspect-ratio\': $ctrl.aspectRatio}" ' +
        'ng-style="{\'padding-bottom\': $ctrl.aspectRatio ? \'calc((100% * \' + $ctrl.aspectRatio.height + \')/\'+$ctrl.aspectRatio.width+\')\' : \'0\'}" ' +
        'ng-href="{{::$ctrl.url}}">' +
        '<img bin-image="{{::$ctrl.code}}" ng-class="{\'cover\': $ctrl.fittingRule == \'cover\', \'contain\': $ctrl.fittingRule == \'contain\'}"/>' +
        '</a>';
    this.bindings = {
        code: '@',
        aspectRatio: '=',
        fittingRule: '='
    };
    this.controller = ['imageManagement', '$element', 'binarta', function (imageManagement, $element, binarta) {
        var self = this;
        binarta.schedule(function() {
            imageManagement.schedule(function() {
                self.url = imageManagement.getImageUrl({code: self.code});
                $element.find('a').magnificPopup({
                    type: 'image',
                    closeOnContentClick: true,
                    image: {
                        verticalFit: true
                    }
                });
            });
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