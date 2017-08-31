angular.module('toggle.edit.mode', [])
    .service('editModeRenderer', function () {
        return jasmine.createSpyObj('editModeRenderer', ['open', 'close']);
    })
    .service('editMode', function () {
        this.bindEvent = jasmine.createSpy('spy');
    });

describe('image-management', function () {
    var binarta, scope, ctrl, directive, notifications, config;
    var $httpBackend, $componentController, $q, $timeout;
    var uploader;
    var _file;
    var file;
    var imageType;

    beforeEach(module('binartajs-angular1-spec'));
    beforeEach(module('image-management'));
    beforeEach(module('permissions'));
    beforeEach(module('cache.control'));
    beforeEach(module('notifications'));
    beforeEach(module('uploader.mock'));
    beforeEach(module('i18n.mock'));
    beforeEach(module('config'));
    beforeEach(inject(function ($injector, $rootScope, _binarta_, _$componentController_, _$q_, _$timeout_) {
        binarta = _binarta_;
        $componentController = _$componentController_;
        $q = _$q_;
        $timeout = _$timeout_;
        scope = $rootScope.$new();
        $httpBackend = $injector.get('$httpBackend');
        _file = {
            size: 2000,
            type: 'image/jpeg',
            name: 'name'
        };
        file = {
            files: [_file]
        };

        binarta.checkpoint.registrationForm.submit({username: 'u', password: 'p'});
    }));
    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });
    afterEach(function () {
        binarta.checkpoint.gateway.removePermission('image.upload');
    });
    afterEach(function () {
        binarta.sessionStorage.removeItem('binartaImageTimestamp');
    });

    function triggerBinartaSchedule() {
        binarta.application.adhesiveReading.read('-');
    }

    describe('imageManagement service', function () {
        var imageManagement, config, code, boxWidth;

        beforeEach(inject(function (_imageManagement_, _config_) {
            imageManagement = _imageManagement_;
            config = _config_;
            config.awsPath = 'http://aws/path/';
            code = 'test.img';
            imageType = 'image-type';
            boxWidth = '100';
        }));

        describe('validate', function () {
            it('under the size limit', function () {
                file.files[0].size = 1023;
                var violations = imageManagement.validate(file);

                expect(violations).toEqual(['contentLength.lowerbound']);
            });

            it('above the size limit', function () {
                file.files[0].size = 10485761;
                var violations = imageManagement.validate(file);

                expect(violations).toEqual(['contentLength.upperbound']);
            });

            it('file type is not an image', function () {
                file.files[0].type = 'application';

                var violations = imageManagement.validate(file);

                expect(violations).toEqual(['contentType.whitelist']);
            });

            it('valid file', function () {
                file.files[0].size = 10000;
                var violations = imageManagement.validate(file);

                expect(violations).toEqual([]);
            });
        });

        describe('upload', function () {
            var uploader, promise;

            beforeEach(inject(function (_uploader_) {
                uploader = _uploader_;
            }));

            describe('when user has no permission', function () {
                var rejectedSpy;

                beforeEach(function () {
                    rejectedSpy = jasmine.createSpy('spy');

                    promise = imageManagement.upload({file: file, code: code, imageType: imageType})
                        .then(function () {
                        }, rejectedSpy);
                    scope.$digest();
                });

                it('is rejected', function () {
                    expect(rejectedSpy).toHaveBeenCalledWith('unauthorized');
                });
            });

            describe('when user has image.upload permission', function () {
                var successSpy, rejectedSpy;

                beforeEach(function () {
                    binarta.checkpoint.gateway.addPermission('image.upload');
                    binarta.checkpoint.profile.refresh();
                    successSpy = jasmine.createSpy('spy');
                    rejectedSpy = jasmine.createSpy('spy');

                    promise = imageManagement.upload({file: file, code: code, imageType: imageType})
                        .then(successSpy, rejectedSpy);
                });

                it('pass values to uploader', function () {
                    expect(uploader.spy.add.file).toEqual(file);
                    expect(uploader.spy.add.path).toEqual(code);
                    expect(uploader.spy.add.imageType).toEqual(imageType);
                    expect(uploader.spy.add.carouselImage).toBeFalsy();
                });

                describe('when upload succeeded', function () {
                    beforeEach(function () {
                        uploader.spy.upload.success('ok');
                        scope.$digest();
                    });

                    it('is resolved', function () {
                        expect(successSpy).toHaveBeenCalledWith('ok');
                    });
                });

                describe('when upload failed', function () {
                    beforeEach(function () {
                        uploader.spy.upload.rejected();
                        scope.$digest();
                    });

                    it('is rejected', function () {
                        expect(rejectedSpy).toHaveBeenCalledWith('upload.failed');
                    });
                });

                it('upload carousel image', function () {
                    imageManagement.upload({file: file, code: code, imageType: imageType, carouselImage: true});

                    expect(uploader.spy.add.carouselImage).toBeTruthy();
                });

                describe('with onUploaded listeners', function () {
                    var uploadCb1, uploadCb2, unsubscribeUploadCb1, unsubscribeUploadCb2;

                    beforeEach(function () {
                        uploadCb1 = jasmine.createSpy('spy');
                        uploadCb2 = jasmine.createSpy('spy');
                        unsubscribeUploadCb1 = imageManagement.onUploaded(uploadCb1);
                        unsubscribeUploadCb2 = imageManagement.onUploaded(uploadCb2);
                        uploader.spy.upload.success('ok');
                    });

                    it('callbacks are executed', function () {
                        expect(uploadCb1).toHaveBeenCalledWith(code);
                        expect(uploadCb2).toHaveBeenCalledWith(code);
                    });

                    describe('on unsubscribe listeners', function () {
                        beforeEach(function () {
                            uploadCb1.calls.reset();
                            uploadCb2.calls.reset();
                            unsubscribeUploadCb1();
                            uploader.spy.upload.success('ok');
                        });

                        it('callbacks are executed', function () {
                            expect(uploadCb1).not.toHaveBeenCalled();
                            expect(uploadCb2).toHaveBeenCalledWith(code);
                        });
                    });
                });
            });
        });
    });

    describe('binImage directive', function () {
        var element, event, directive, imageManagement, addedClass, removedClass;
        var imagePath = 'image/path.jpg';

        beforeEach(function () {
            var minWidth = 60;

            scope.bindImageEvents = jasmine.createSpy('bindImageEvents');
            scope.bindClickEvent = jasmine.createSpy('bindClickEvent');

            addedClass = [];
            removedClass = [];
            event = [];
            element = {
                parent: function () {
                    return {
                        width: function () {
                            return --minWidth;
                        },
                        parent: function () {
                            return {
                                width: function () {
                                    return 100;
                                }
                            }
                        }
                    }
                },
                addClass: function (c) {
                    addedClass.push(c)
                },
                removeClass: function (c) {
                    removedClass.push(c);
                },
                bind: function (e, f) {
                    event[e] = f;
                },
                unbind: function (e) {
                    event[e] = undefined;
                }
            };
            element[0] = {};

            imageManagement = {
                image: {
                    minWidth: minWidth
                },
                getImagePathSpy: {},
                getImageUrl: function (args) {
                    imageManagement.getImagePathSpy = args;
                    return imagePath;
                },
                getImagePath: function (args) {
                    imageManagement.getImagePathSpy = args;
                    var deferred = $q.defer();
                    deferred.resolve(imagePath);
                    return deferred.promise;
                },
                schedule: function (it) {
                    it();
                }
            };

            directive = BinImageDirectiveFactory($timeout, imageManagement, binarta);
        });

        it('restrict', function () {
            expect(directive.restrict).toEqual('A');
        });

        it('uses child scope', function () {
            expect(directive.scope).toEqual(true);
        });

        it('controller', function () {
            expect(directive.controller).toEqual('binImageController');
        });

        describe('on link', function () {
            beforeEach(function () {
                directive.link(scope, element, {binImage: 'test.img'});
                $timeout.flush();
            });

            it('put code on scope', function () {
                expect(scope.code).toEqual('test.img');
            });

            it('bind image events', function () {
                expect(scope.bindImageEvents).toHaveBeenCalled();
            });

            it('bind click event', function () {
                expect(scope.bindClickEvent).toHaveBeenCalled();
            });

            it('get image path', function () {
                triggerBinartaSchedule();
                expect(imageManagement.getImagePathSpy).toEqual({code: 'test.img', width: 100});
                expect(element[0].src).toEqual(imagePath);
            });

            it('update image src', function () {
                scope.setImageSrc('test');
                expect(element[0].src).toEqual('test');
            });

            it('image src is on scope', function () {
                scope.setImageSrc('test');
                expect(scope.src).toEqual('test');
            });

            describe('with width attribute on image', function () {
                beforeEach(function () {
                    directive.link(scope, element, {binImage: 'test.img', width: '200'});
                    $timeout.flush();
                });

                it('get image path', function () {
                    triggerBinartaSchedule();
                    expect(imageManagement.getImagePathSpy).toEqual({code: 'test.img', width: 200});
                });
            });

            describe('with height attribute on image', function () {
                beforeEach(function () {
                    directive.link(scope, element, {binImage: 'test.img', height: '200'});
                    $timeout.flush();
                });

                it('get image path', function () {
                    triggerBinartaSchedule();
                    expect(imageManagement.getImagePathSpy).toEqual({code: 'test.img', height: 200});
                });
            });

            describe('with width and height attributes on image', function () {
                beforeEach(function () {
                    directive.link(scope, element, {binImage: 'test.img', width: '200', height: '100'});
                    $timeout.flush();
                });

                it('get image path', function () {
                    triggerBinartaSchedule();
                    expect(imageManagement.getImagePathSpy).toEqual({code: 'test.img', width: 200, height: 100});
                });
            });
        });

        describe('when element has no parent anymore', function () {
            beforeEach(function () {
                element.parent = function () {
                    return {
                        width: function () {
                            return null;
                        }
                    }
                };
                imageManagement.getImageUrl = jasmine.createSpy('spy');
                directive.link(scope, element, {binImage: 'test.img'});
                $timeout.flush();
            });

            it('do not get image path', function () {
                expect(imageManagement.getImageUrl).not.toHaveBeenCalled();
            });
        });

        describe('when image is read-only', function () {
            beforeEach(function () {
                directive.link(scope, element, {binImage: 'test.img', readOnly: ''});
                scope.$digest();
            });

            it('bind click event is not called', function () {
                expect(scope.bindClickEvent).not.toHaveBeenCalled();
            });
        });

        it('strip leading slash on code', function () {
            directive.link(scope, element, {binImage: '/test.img'});

            scope.$digest();

            expect(scope.code).toEqual('test.img');
        });
    });

    describe('binBackgroundImage directive', function () {
        var scope, element, directive, imageManagement, cssSpy, getImagePathDeferred, bindImageEventsDeferred;
        var imagePath = 'image/path.jpg';

        beforeEach(inject(function ($rootScope, $q) {
            scope = $rootScope.$new();

            bindImageEventsDeferred = $q.defer();
            scope.bindImageEvents = jasmine.createSpy('bindImageEvents').and.returnValue(bindImageEventsDeferred.promise);
            scope.bindClickEvent = jasmine.createSpy('bindClickEvent');

            element = {
                width: function () {
                    return 100;
                },
                css: function (k, v) {
                    cssSpy = {
                        key: k,
                        value: v
                    }
                }
            };
            element[0] = {};

            imageManagement = {
                getImageUrl: jasmine.createSpy('getImageUrl').and.returnValue(imagePath),
                getImageUrl: jasmine.createSpy('getImageUrl').and.returnValue('img-url'),
                schedule: function (it) {
                    it();
                }
            };

            directive = BinBackgroundImageDirectiveFactory($timeout, imageManagement, binarta);
        }));

        it('restrict', function () {
            expect(directive.restrict).toEqual('A');
        });

        it('uses child scope', function () {
            expect(directive.scope).toEqual(true);
        });

        it('controller', function () {
            expect(directive.controller).toEqual('binImageController');
        });

        describe('on link', function () {
            beforeEach(function () {
                triggerBinartaSchedule();
                directive.link(scope, element, {binBackgroundImage: 'test.img'});
                $timeout.flush();
            });

            it('put code on scope', function () {
                expect(scope.code).toEqual('test.img');
            });

            it('get image path', function () {
                expect(imageManagement.getImageUrl).toHaveBeenCalledWith({code: 'test.img', width: 100});
                expect(imageManagement.getImageUrl.calls.count()).toEqual(1);
            });

            it('background image is set on element', function () {
                expect(cssSpy).toEqual({key: 'background-image', value: 'url("img-url")'});
            });

            it('update image src', function () {
                scope.setImageSrc('test');
                expect(cssSpy).toEqual({key: 'background-image', value: 'url("test")'});
            });

            it('image src is on scope', function () {
                scope.setImageSrc('test');
                expect(scope.src).toEqual('test');
            });
        });

        describe('when image is read-only', function () {
            beforeEach(function () {
                directive.link(scope, element, {binBackgroundImage: 'test.img', readOnly: ''});
                scope.$digest();
            });

            it('bind click event is not called', function () {
                expect(scope.bindClickEvent).not.toHaveBeenCalled();
            });
        });

        describe('when width is defined on attributes', function () {
            beforeEach(function () {
                triggerBinartaSchedule();
                directive.link(scope, element, {binBackgroundImage: 'test.img', width: '200'});
                $timeout.flush();
            });

            it('get image path', function () {
                expect(imageManagement.getImageUrl).toHaveBeenCalledWith({code: 'test.img', width: 200});
            });
        });

        it('strip leading slash on code', function () {
            directive.link(scope, element, {binBackgroundImage: '/test.img'});

            scope.$digest();

            expect(scope.code).toEqual('test.img');
        });
    });

    describe('binImageController', function () {
        var element, event, editModeRenderer, editModeRendererSpy, imageManagement, addedClass, removedClass,
            registry, $window, unsubscribeOnUploadedSpy, fallbackSrc;

        beforeEach(inject(function (ngRegisterTopicHandler, topicRegistryMock, _$window_) {
            fallbackSrc = '//cdn.binarta.com/image/icons/camera-faded.svg';

            scope.setImageSrc = function (src) {
                scope.setImageSrcSpy = src;
            };

            scope.setDefaultImageSrc = function () {
                scope.setDefaultImageSrcCalled = true;
            };

            scope.code = 'test.img';

            addedClass = [];
            removedClass = [];
            event = [];
            element = {
                addClass: function (c) {
                    addedClass.push(c)
                },
                removeClass: function (c) {
                    removedClass.push(c);
                },
                bind: function (e, f) {
                    event[e] = f;
                },
                unbind: function (e) {
                    event[e] = undefined;
                },
                is: function () {
                }
            };

            registry = topicRegistryMock;

            unsubscribeOnUploadedSpy = jasmine.createSpy('spy');

            imageManagement = {
                fileUploadSpy: {},
                fileUploadClicked: false,
                fileUpload: function (ctx) {
                    imageManagement.fileUploadSpy = ctx;
                    return {
                        click: function () {
                            imageManagement.fileUploadClicked = true;
                        }
                    }
                },
                validateSpy: {},
                validateReturn: [],
                validate: function (file) {
                    imageManagement.validateSpy = file;
                    return imageManagement.validateReturn;
                },
                uploadSpy: {},
                upload: function (ctx) {
                    imageManagement.uploadSpy = ctx;
                    var deferred = $q.defer();
                    deferred.resolve('');
                    return deferred.promise;
                },
                onUploaded: jasmine.createSpy('spy').and.returnValue(unsubscribeOnUploadedSpy)
            };

            editModeRendererSpy = {};

            editModeRenderer = {
                open: function (args) {
                    editModeRendererSpy.open = args;
                },
                close: function () {
                    editModeRendererSpy.close = true;
                }
            };

            $window = _$window_;
            $window.URL = {
                createObjectURL: function (file) {
                    $window.URL.createObjectURLSpy = file;
                    return 'objectUrl';
                },
                revokeObjectURL: function (url) {
                    $window.URL.revokeObjectURLSpy = url;
                }
            };

            BinImageController(scope, element, imageManagement, editModeRenderer, binarta, ngRegisterTopicHandler, $window);
        }));

        describe('bind image events', function () {
            describe('and no args given', function () {
                beforeEach(function () {
                    scope.bindImageEvents();
                    scope.$digest();
                });

                describe('when image not found', function () {
                    beforeEach(function () {
                        event['error']();
                    });

                    it('put not-found class on element', function () {
                        expect(addedClass[0]).toEqual('not-found');
                    });

                    it('set image src to fallback image', function () {
                        expect(scope.setImageSrcSpy).toEqual(fallbackSrc);
                    });

                    describe('and fallback image is loaded', function () {
                        beforeEach(function () {
                            scope.src = fallbackSrc;
                            event['load']();
                        });

                        it('not-found class is still on element', function () {
                            expect(addedClass[0]).toEqual('not-found');
                        });
                    });
                });

                describe('when image aborted', function () {
                    beforeEach(function () {
                        event['abort']();
                    });

                    it('put not-found class on element', function () {
                        expect(addedClass[0]).toEqual('not-found');
                    });
                });

                describe('when image is found', function () {
                    beforeEach(function () {
                        event['load']();
                    });

                    it('put not-found class on element', function () {
                        expect(removedClass[0]).toEqual('not-found');
                    });
                });
            });

            describe('with args given', function () {
                var events = [];
                var newElement = {
                    bind: function (event) {
                        events.push(event);
                    }
                };

                beforeEach(function () {
                    scope.bindImageEvents({
                        bindOn: newElement
                    });
                    scope.$digest();
                });

                it('events are bound to other element', function () {
                    expect(events).toEqual(['load', 'error', 'abort']);
                });
            });
        });

        describe('bind click event', function () {
            describe('when user has permission', function () {
                beforeEach(function () {
                    binarta.checkpoint.gateway.addPermission('image.upload');
                    binarta.checkpoint.profile.refresh();
                });

                describe('and edit.mode true bindEvent received', function () {
                    beforeEach(function () {
                        scope.bindClickEvent();
                    });
                    beforeEach(function () {
                        registry['edit.mode'](true);
                    });

                    it('bind element to click bindEvent', function () {
                        expect(event['click']).toBeDefined();
                    });

                    describe('and element is clicked', function () {
                        var clickResponse;

                        beforeEach(function () {
                            scope.state = 'loaded';
                            clickResponse = event['click']();
                        });

                        it('click event returns false to prevent the default action and stop propagation', function () {
                            expect(clickResponse).toEqual(false);
                        });

                        it('fileupload is executed', function () {
                            expect(imageManagement.fileUploadSpy).toBeDefined();
                            expect(imageManagement.fileUploadClicked).toBeTruthy();
                        });

                        it('with context', function () {
                            expect(imageManagement.fileUploadSpy.dataType).toEqual('json');
                            expect(imageManagement.fileUploadSpy.add).toEqual(jasmine.any(Function));
                        });

                        describe('image is added', function () {
                            describe('with violations', function () {
                                beforeEach(function () {
                                    imageManagement.validateReturn = ['violation'];

                                    imageManagement.fileUploadSpy.add(null, file);
                                });

                                it('put violation on scope', function () {
                                    expect(scope.violation).toEqual('violation');
                                });

                                it('reset state', function () {
                                    expect(editModeRendererSpy.open.scope.state).toEqual('');
                                });
                            });

                            describe('without violations', function () {
                                beforeEach(function () {
                                    imageManagement.fileUploadSpy.add(null, file);
                                });

                                it('editModeRenderer is opened', function () {
                                    expect(editModeRendererSpy.open.scope.$parent).toEqual(scope);
                                    expect(editModeRendererSpy.open.templateUrl).toEqual(jasmine.any(String));
                                });

                                it('no violation on scope', function () {
                                    expect(scope.violation).toBeUndefined();
                                });

                                describe('when URL is available', function () {
                                    it('state is set to preview', function () {
                                        expect(editModeRendererSpy.open.scope.state).toEqual('preview');
                                    });

                                    it('get object url from URL', function () {
                                        expect($window.URL.createObjectURLSpy).toEqual(_file);
                                    });

                                    it('set image source', function () {
                                        expect(scope.setImageSrcSpy).toEqual('objectUrl');
                                    });

                                    describe('new image is added', function () {
                                        beforeEach(function () {
                                            imageManagement.fileUploadSpy.add(null, file);
                                        });

                                        it('previous object url is revoked', function () {
                                            expect($window.URL.revokeObjectURLSpy).toEqual('objectUrl');
                                        });
                                    });
                                });

                                describe('when URL is not available', function () {
                                    beforeEach(function () {
                                        $window.URL = undefined;
                                        imageManagement.fileUploadSpy.add(null, file);
                                    });

                                    it('image is submitted', function () {
                                        expect(imageManagement.uploadSpy.file).toEqual(file);
                                    });
                                });

                                describe('on submit without image type', function () {
                                    var matchOn;

                                    beforeEach(function () {
                                        element.is = function (m) {
                                            matchOn = m;
                                            return true;
                                        };

                                        editModeRendererSpy.open.scope.submit();
                                    });

                                    it('check if img', function () {
                                        expect(matchOn).toEqual('img');
                                    });

                                    it('test', function () {
                                        expect(imageManagement.uploadSpy.imageType).toEqual('foreground');
                                    });
                                });

                                describe('on submit', function () {
                                    beforeEach(function () {
                                        element.is = function () {
                                            return false;
                                        };

                                        editModeRendererSpy.open.scope.submit();
                                    });

                                    it('add uploading class', function () {
                                        expect(addedClass[0]).toEqual('uploading');
                                    });

                                    it('upload', function () {
                                        expect(imageManagement.uploadSpy.file).toEqual(file);
                                        expect(imageManagement.uploadSpy.code).toEqual('test.img');
                                        expect(imageManagement.uploadSpy.imageType).toEqual('background');
                                    });

                                    describe('upload success', function () {
                                        beforeEach(function () {
                                            scope.$digest();
                                        });

                                        it('reset state', function () {
                                            expect(editModeRendererSpy.open.scope.state).toEqual('');
                                        });

                                        it('remove uploading class', function () {
                                            expect(removedClass[0]).toEqual('uploading');
                                        });

                                        it('set image path', function () {
                                            expect(scope.setDefaultImageSrcCalled).toBeTruthy();
                                        });

                                        it('close editModeRenderer', function () {
                                            expect(editModeRendererSpy.close).toBeTruthy();
                                        });

                                        it('preview image object url is revoked', function () {
                                            expect($window.URL.revokeObjectURLSpy).toEqual('objectUrl');
                                        });
                                    });
                                });

                                describe('on close', function () {
                                    beforeEach(function () {
                                        editModeRendererSpy.open.scope.close();
                                    });

                                    it('set image path', function () {
                                        expect(scope.setDefaultImageSrcCalled).toBeTruthy();
                                    });

                                    it('close editModeRenderer', function () {
                                        expect(editModeRendererSpy.close).toBeTruthy();
                                    });

                                    it('preview image object url is revoked', function () {
                                        expect($window.URL.revokeObjectURLSpy).toEqual('objectUrl');
                                    });
                                });
                            });
                        });
                    });
                });

                describe('and edit.mode false bindEvent received', function () {
                    beforeEach(function () {
                        scope.bindClickEvent();
                    });
                    beforeEach(function () {
                        registry['edit.mode'](false);
                    });

                    it('unbind element from click bindEvent', function () {
                        expect(event['click']).toBeUndefined();
                    });
                });
            });

            describe('when user has no permission', function () {
                it('unbind element from click bindEvent', function () {
                    expect(event['click']).toBeUndefined();
                });
            });
        });

        it('subscribes to new uploads', function () {
            expect(imageManagement.onUploaded).toHaveBeenCalled();
        });

        describe('on new upload', function () {
            beforeEach(function () {
                scope.setDefaultImageSrcCalled = false;
                imageManagement.onUploaded.calls.mostRecent().args[0](scope.code);
            });

            it('reset image src', function () {
                expect(scope.setDefaultImageSrcCalled).toBeTruthy();
            });
        });

        describe('on new upload for other image', function () {
            beforeEach(function () {
                scope.setDefaultImageSrcCalled = false;
                imageManagement.onUploaded.calls.mostRecent().args[0]('other');
            });

            it('reset image src', function () {
                expect(scope.setDefaultImageSrcCalled).toBeFalsy();
            });
        });

        describe('on destroy', function () {
            beforeEach(function () {
                scope.$destroy();
            });

            it('on uploaded listener is unsubscribed', function () {
                expect(unsubscribeOnUploadedSpy).toHaveBeenCalled();
            });
        });
    });

    describe('BinImageEnlargedController', function () {
        var ctrl, findArgs, magnificPopupArgs, imageSpy;

        beforeEach(inject(function ($componentController) {
            imageSpy = {
                getImageUrl: jasmine.createSpy('getImageUrl').and.returnValue('img-url'),
                schedule: function (it) {
                    it();
                }
            };

            var elementMock = {
                find: function (element) {
                    findArgs = element;
                    return {
                        magnificPopup: function (config) {
                            magnificPopupArgs = config;
                        }
                    }
                }
            };
            triggerBinartaSchedule();
            ctrl = $componentController('binImageEnlarged', {
                imageManagement: imageSpy,
                $element: elementMock
            }, {code: 'test.img'});
        }));

        it('url is correct', function () {
            expect(imageSpy.getImageUrl).toHaveBeenCalledWith({code: 'test.img'});
            expect(ctrl.url).toEqual('img-url');
        });

        it('magnific popup is called correctly', function () {
            expect(findArgs).toEqual('a');
            expect(magnificPopupArgs).toEqual({
                type: 'image',
                closeOnContentClick: true,
                image: {
                    verticalFit: true
                }
            });
        });
    });

    describe('binImageUploader component', function () {
        var $ctrl, bindings, imageManagement, imageSrc, fileUploadClickSpy, uploadDeferred;

        beforeEach(inject(function (_imageManagement_) {
            imageManagement = _imageManagement_;
            imageSrc = 'www.image.url';
            fileUploadClickSpy = jasmine.createSpy('spy');
            uploadDeferred = $q.defer();
            spyOn(imageManagement, 'getImageUrl').and.returnValue(imageSrc);
            spyOn(imageManagement, 'fileUpload').and.returnValue({click: fileUploadClickSpy});
            spyOn(imageManagement, 'upload').and.returnValue(uploadDeferred.promise);
        }));

        describe('with only required bindings', function () {
            beforeEach(function () {
                bindings = {
                    imageCode: 'code'
                };
                $ctrl = $componentController('binImageUploader', undefined, bindings);
                $ctrl.$onInit();
            });

            describe('on upload', function () {
                beforeEach(function () {
                    $ctrl.upload();
                });

                it('fileUpload is called', function () {
                    expect(imageManagement.fileUpload).toHaveBeenCalledWith({
                        dataType: 'json',
                        add: jasmine.any(Function)
                    });
                });

                it('fileUpload is triggered', function () {
                    expect(fileUploadClickSpy).toHaveBeenCalled();
                });

                describe('and file is valid', function () {
                    beforeEach(function () {
                        spyOn(imageManagement, 'validate').and.returnValue([]);
                        imageManagement.fileUpload.calls.mostRecent().args[0].add(null, file);
                    });

                    it('file is validated', function () {
                        expect(imageManagement.validate).toHaveBeenCalledWith(file);
                    });

                    it('upload is called', function () {
                        expect(imageManagement.upload).toHaveBeenCalledWith({
                            file: file,
                            code: 'code',
                            imageType: 'foreground'
                        });
                    });

                    it('is working', function () {
                        expect($ctrl.working).toBeTruthy();
                    });

                    describe('and upload succeeded', function () {
                        beforeEach(function () {
                            uploadDeferred.resolve();
                            scope.$digest();
                        });

                        it('not working anymore', function () {
                            expect($ctrl.working).toBeFalsy();
                        });
                    });

                    describe('and upload failed', function () {
                        beforeEach(function () {
                            uploadDeferred.reject('upload.failed');
                            scope.$digest();
                        });

                        it('violation is set', function () {
                            expect($ctrl.violations).toEqual(['upload.failed']);
                        });

                        it('not working anymore', function () {
                            expect($ctrl.working).toBeFalsy();
                        });
                    });
                });

                describe('and file is invalid', function () {
                    beforeEach(function () {
                        spyOn(imageManagement, 'validate').and.returnValue(['invalid']);
                        imageManagement.fileUpload.calls.mostRecent().args[0].add(null, file);
                    });

                    it('violations are set', function () {
                        expect($ctrl.violations).toEqual(['invalid']);
                    });

                    it('not working anymore', function () {
                        expect($ctrl.working).toBeFalsy();
                    });
                });
            });
        });

        describe('when onUpload callback is given', function () {
            var onUploadSpy;

            beforeEach(function () {
                onUploadSpy = jasmine.createSpy('spy');
                bindings = {
                    imageCode: 'code',
                    onUpload: onUploadSpy
                };
                $ctrl = $componentController('binImageUploader', undefined, bindings);
                $ctrl.$onInit();
            });

            describe('on upload', function () {
                beforeEach(function () {
                    $ctrl.upload();
                });

                describe('and file is valid', function () {
                    beforeEach(function () {
                        spyOn(imageManagement, 'validate').and.returnValue([]);
                        imageManagement.fileUpload.calls.mostRecent().args[0].add(null, file);
                    });

                    describe('and upload succeeded', function () {
                        beforeEach(function () {
                            uploadDeferred.resolve();
                            scope.$digest();
                        });

                        it('on upload handler is called', function () {
                            expect(onUploadSpy).toHaveBeenCalled();
                        });
                    });
                });
            });
        });
    });

    describe('binIcon component', function () {
        var $ctrl, editMode, renderer, imageManagement, configWriter, configWriterDeferred;
        var element = angular.element('<div></div>');
        var bindings, permission;

        beforeEach(inject(function ($rootScope, _editMode_, _editModeRenderer_, _configWriter_, _imageManagement_) {
            bindings = {iconCode: 'test.icon', code: '/test.code', default: 'default'};
            editMode = _editMode_;
            renderer = _editModeRenderer_;
            imageManagement = _imageManagement_;
            configWriter = _configWriter_;
            configWriterDeferred = $q.defer();
            configWriter.and.returnValue(configWriterDeferred.promise);
            binarta.application.gateway.clear();
            permission = 'icon.upload';
        }));

        describe('when value is given without an update callback', function () {
            beforeEach(function () {
                bindings.value = 'value';
                $ctrl = $componentController('binIcon', {$element: element, $scope: scope}, bindings);
                $ctrl.$onInit();
            });

            describe('and public config does not contain any value', function () {
                beforeEach(function () {
                    triggerBinartaSchedule();
                });

                it('default icon value is used', function () {
                    expect($ctrl.iconValue).toEqual('default');
                });
            });

            describe('and public config contains a value', function () {
                beforeEach(function () {
                    binarta.application.gateway.addPublicConfig({id: 'icons/test.code', value: 'test'});
                    triggerBinartaSchedule();
                });

                it('value is set', function () {
                    expect($ctrl.iconValue).toEqual('test');
                });
            });
        });

        describe('when value is given but empty and update callback is set', function () {
            beforeEach(function () {
                bindings.value = '';
                bindings.onUpdate = function () {
                };
                $ctrl = $componentController('binIcon', {$element: element, $scope: scope}, bindings);
                $ctrl.$onInit();
            });

            describe('and public config does not contain any value', function () {
                beforeEach(function () {
                    triggerBinartaSchedule();
                });

                it('default icon value is used', function () {
                    expect($ctrl.iconValue).toEqual('default');
                });
            });

            describe('and public config contains a value', function () {
                beforeEach(function () {
                    binarta.application.gateway.addPublicConfig({id: 'icons/test.code', value: 'test'});
                    triggerBinartaSchedule();
                });

                it('value is set', function () {
                    expect($ctrl.iconValue).toEqual('test');
                });
            });
        });

        describe('when value and update callback are given', function () {
            var onUpdateSpy;

            beforeEach(function () {
                onUpdateSpy = jasmine.createSpy('spy');
                bindings.value = 'value';
                bindings.onUpdate = onUpdateSpy;
                $ctrl = $componentController('binIcon', {$element: element, $scope: scope}, bindings);
                $ctrl.$onInit();
            });

            describe('and public config does not contain any value', function () {
                beforeEach(function () {
                    triggerBinartaSchedule();
                });

                it('value is not overridden', function () {
                    expect($ctrl.iconValue).toEqual('value');
                });
            });

            describe('and public config contains a value', function () {
                beforeEach(function () {
                    binarta.application.gateway.addPublicConfig({id: 'icons/test.code', value: 'test'});
                    triggerBinartaSchedule();
                });

                it('value is not overridden', function () {
                    expect($ctrl.iconValue).toEqual('value');
                });
            });

            describe('when user is in edit mode', function () {
                var rendererScope;

                describe('when setting an icon', function () {
                    beforeEach(function () {
                        editMode.bindEvent.calls.mostRecent().args[0].onClick();
                        rendererScope = renderer.open.calls.first().args[0].scope;
                    });

                    describe('on submit', function () {
                        beforeEach(function () {
                            rendererScope.state.icon = 'fa-pencil';
                            rendererScope.submit();
                        });

                        it('on update callback is executed', function () {
                            expect($ctrl.onUpdate).toHaveBeenCalledWith({
                                request: {
                                    key: 'icon',
                                    value: 'fa-pencil'
                                },
                                response: {
                                    success: jasmine.any(Function),
                                    error: jasmine.any(Function)
                                }
                            });
                        });

                        describe('on success', function () {
                            beforeEach(function () {
                                $ctrl.onUpdate.calls.mostRecent().args[0].response.success();
                            });

                            it('new icon code is used', function () {
                                expect($ctrl.iconValue).toEqual('fa-pencil');
                            });

                            it('renderer is closed', function () {
                                expect(renderer.close).toHaveBeenCalled();
                            });
                        });

                        describe('on error', function () {
                            beforeEach(function () {
                                $ctrl.onUpdate.calls.mostRecent().args[0].response.error();
                            });

                            it('new icon code is not used', function () {
                                expect($ctrl.iconValue).toEqual('value');
                            });

                            it('violations are set on scope', function () {
                                expect($ctrl.violations).toEqual(['update.failed']);
                            });

                            it('renderer is not closed', function () {
                                expect(renderer.close).not.toHaveBeenCalled();
                            });
                        });
                    });
                });

                describe('when setting an image', function () {
                    beforeEach(function () {
                        binarta.checkpoint.gateway.addPermission(permission);
                        binarta.checkpoint.profile.refresh();
                        binarta.application.gateway.addPublicConfig({id: 'icons/test.code', value: 'f'});
                        triggerBinartaSchedule();
                        editMode.bindEvent.calls.mostRecent().args[0].onClick();
                        rendererScope = renderer.open.calls.first().args[0].scope;
                        rendererScope.changeView();
                    });

                    it('state is set to image', function () {
                        expect(rendererScope.state.name).toEqual('image');
                    });

                    describe('on submit', function () {
                        beforeEach(function () {
                            rendererScope.submit();
                        });

                        it('on update callback is executed', function () {
                            expect($ctrl.onUpdate).toHaveBeenCalledWith({
                                request: {
                                    key: 'icon',
                                    value: 'image'
                                },
                                response: {
                                    success: jasmine.any(Function),
                                    error: jasmine.any(Function)
                                }
                            });
                        });

                        describe('on success', function () {
                            beforeEach(function () {
                                $ctrl.onUpdate.calls.mostRecent().args[0].response.success();
                            });

                            it('value is set', function () {
                                expect($ctrl.iconValue).toEqual('image');
                            });

                            it('renderer is closed', function () {
                                expect(renderer.close).toHaveBeenCalled();
                            });
                        });

                        describe('on error', function () {
                            beforeEach(function () {
                                $ctrl.onUpdate.calls.mostRecent().args[0].response.error();
                            });

                            it('value is not set', function () {
                                expect($ctrl.iconValue).toEqual('value');
                            });

                            it('violations are set on scope', function () {
                                expect($ctrl.violations).toEqual(['update.failed']);
                            });

                            it('renderer is not closed', function () {
                                expect(renderer.close).not.toHaveBeenCalled();
                            });
                        });
                    });
                });
            });
        });

        describe('when value is not given', function () {
            beforeEach(function () {
                $ctrl = $componentController('binIcon', {$element: element, $scope: scope}, bindings);
                $ctrl.$onInit();
            });

            it('edit mode event is bound', function () {
                expect(editMode.bindEvent).toHaveBeenCalledWith({
                    scope: scope,
                    element: element,
                    permission: 'edit.mode',
                    onClick: jasmine.any(Function)
                });
            });

            describe('when public config does not contain any value', function () {
                beforeEach(function () {
                    triggerBinartaSchedule();
                });

                it('default icon value is used', function () {
                    expect($ctrl.iconValue).toEqual('default');
                });
            });

            describe('correct media is rendered according to type', function () {
                describe('when image is active', function () {
                    beforeEach(function () {
                        binarta.application.gateway.addPublicConfig({id: 'icons/test.code', value: 'image'});
                        triggerBinartaSchedule();
                    });

                    it('value is set to image', function () {
                        expect($ctrl.iconValue).toEqual('image');
                    });
                });

                describe('when icon is active', function () {
                    beforeEach(function () {
                        binarta.application.gateway.addPublicConfig({id: 'icons/test.code', value: 'fa-bike'});
                        triggerBinartaSchedule();
                    });

                    it('value is available on ctrl', function () {
                        expect($ctrl.iconValue).toEqual('fa-bike');
                    });
                });
            });

            describe('when user is in edit mode', function () {
                var rendererScope;

                describe('when an icon was displayed on a page', function () {
                    beforeEach(function () {
                        $ctrl.iconValue = 'fa-test';
                        editMode.bindEvent.calls.mostRecent().args[0].onClick();
                        rendererScope = renderer.open.calls.first().args[0].scope;
                    });

                    it('editModeRenderer is called', function () {
                        expect(renderer.open).toHaveBeenCalledWith({
                            scope: rendererScope,
                            templateUrl: 'bin-icon-edit.html'
                        });
                    });

                    it('$ctrl is available trough rendererScope', function () {
                        expect(rendererScope.$ctrl).toBe($ctrl);
                    });

                    it('is in icon state', function () {
                        expect(rendererScope.state.name).toEqual('icon');
                    });

                    it('icon is available on the state', function () {
                        expect(rendererScope.state.icon).toEqual('fa-test');
                    });

                    it('image source is not on state', function () {
                        expect(rendererScope.state.imageSrc).toBeUndefined();
                    });

                    it('on cancel', function () {
                        rendererScope.cancel();
                        expect(renderer.close).toHaveBeenCalled();
                    });

                    describe('when user has no permission', function () {
                        it('upload is not permitted', function () {
                            expect(rendererScope.state.isUploadPermitted).toBeFalsy();
                        });

                        describe('and switching to an image state', function () {
                            beforeEach(function () {
                                rendererScope.changeView();
                            });

                            it('is still in icon state', function () {
                                expect(rendererScope.state.name).toEqual('icon');
                            });
                        });
                    });

                    describe('when user has permission', function () {
                        beforeEach(function () {
                            binarta.checkpoint.gateway.addPermission(permission);
                            binarta.checkpoint.profile.refresh();
                        });

                        it('upload is permitted', function () {
                            editMode.bindEvent.calls.mostRecent().args[0].onClick();
                            rendererScope = renderer.open.calls.mostRecent().args[0].scope;
                            expect(rendererScope.state.isUploadPermitted).toBeTruthy();
                        });

                        describe('and switching to an image state', function () {
                            beforeEach(function () {
                                rendererScope.changeView();
                            });

                            it('is in image state', function () {
                                expect(rendererScope.state.name).toEqual('image');
                            });

                            it('icon is not available on the state', function () {
                                expect(rendererScope.state.icon).toBeUndefined();
                            });
                        });
                    });
                });

                describe('when an image was displayed on a page', function () {
                    beforeEach(function () {
                        $ctrl.iconValue = 'image';
                    });

                    describe('and user has no permission', function () {
                        beforeEach(function () {
                            editMode.bindEvent.calls.mostRecent().args[0].onClick();
                            rendererScope = renderer.open.calls.first().args[0].scope;
                        });

                        it('is in icon state', function () {
                            expect(rendererScope.state.name).toEqual('icon');
                        });
                    });

                    describe('and user has permission', function () {
                        beforeEach(function () {
                            binarta.checkpoint.gateway.addPermission(permission);
                            binarta.checkpoint.profile.refresh();
                            editMode.bindEvent.calls.mostRecent().args[0].onClick();
                            rendererScope = renderer.open.calls.first().args[0].scope;
                        });

                        it('state is set to image', function () {
                            expect(rendererScope.state.name).toEqual('image');
                        });

                        it('editModeRenderer is called', function () {
                            expect(renderer.open).toHaveBeenCalledWith({
                                scope: rendererScope,
                                templateUrl: 'bin-icon-edit.html'
                            });
                        });

                        it('icon is not available on the state', function () {
                            expect(rendererScope.state.icon).toBeUndefined();
                        });

                        it('on cancel', function () {
                            rendererScope.cancel();
                            expect(renderer.close).toHaveBeenCalled();
                        });

                        describe('when switching to an icon state', function () {
                            beforeEach(function () {
                                rendererScope.changeView();
                            });

                            it('is in icon state', function () {
                                expect(rendererScope.state.name).toEqual('icon');
                            });

                            it('imageSrc is not available', function () {
                                expect(rendererScope.state.imageSrc).toBeUndefined();
                            });

                            it('no specific icon value was set', function () {
                                expect(rendererScope.state.icon).toEqual('');
                            });
                        });
                    });
                });

                describe('when setting an icon', function () {
                    beforeEach(function () {
                        $ctrl.iconValue = 'f';
                        editMode.bindEvent.calls.mostRecent().args[0].onClick();
                        rendererScope = renderer.open.calls.first().args[0].scope;
                    });

                    describe('on submit', function () {
                        beforeEach(function () {
                            rendererScope.state.icon = 'fa-pencil';
                            rendererScope.submit();
                        });

                        it('config is updated with the new icon value', function () {
                            expect(configWriter).toHaveBeenCalledWith({
                                scope: 'public',
                                key: 'icons/test.code',
                                value: 'fa-pencil'
                            });
                        });

                        describe('on config updated', function () {
                            beforeEach(function () {
                                configWriterDeferred.resolve();
                                scope.$digest();
                            });

                            it('new icon code is used', function () {
                                expect($ctrl.iconValue).toEqual('fa-pencil');
                            });

                            it('renderer is closed', function () {
                                expect(renderer.close).toHaveBeenCalled();
                            });
                        });

                        describe('on config update failure', function () {
                            beforeEach(function () {
                                configWriterDeferred.reject();
                                scope.$digest();
                            });

                            it('new icon code is not used', function () {
                                expect($ctrl.iconValue).toEqual('f');
                            });

                            it('violations are set on scope', function () {
                                expect($ctrl.violations).toEqual(['update.failed']);
                            });

                            it('renderer is not closed', function () {
                                expect(renderer.close).not.toHaveBeenCalled();
                            });
                        });
                    });
                });

                describe('when setting an image', function () {
                    beforeEach(function () {
                        binarta.checkpoint.gateway.addPermission(permission);
                        binarta.checkpoint.profile.refresh();
                        binarta.application.gateway.addPublicConfig({id: 'icons/test.code', value: 'f'});
                        triggerBinartaSchedule();
                        editMode.bindEvent.calls.mostRecent().args[0].onClick();
                        rendererScope = renderer.open.calls.first().args[0].scope;
                        rendererScope.changeView();
                    });

                    it('state is set to image', function () {
                        expect(rendererScope.state.name).toEqual('image');
                    });

                    describe('on submit', function () {
                        beforeEach(function () {
                            rendererScope.submit();
                        });

                        it('config is updated with the new icon value', function () {
                            expect(configWriter).toHaveBeenCalledWith({
                                scope: 'public',
                                key: 'icons/test.code',
                                value: 'image'
                            });
                        });

                        describe('on config updated', function () {
                            beforeEach(function () {
                                configWriterDeferred.resolve();
                                scope.$digest();
                            });

                            it('value is set', function () {
                                expect($ctrl.iconValue).toEqual('image');
                            });

                            it('renderer is closed', function () {
                                expect(renderer.close).toHaveBeenCalled();
                            });
                        });

                        describe('on config update failure', function () {
                            beforeEach(function () {
                                configWriterDeferred.reject();
                                scope.$digest();
                            });

                            it('value is not set', function () {
                                expect($ctrl.iconValue).toEqual('f');
                            });

                            it('violations are set on scope', function () {
                                expect($ctrl.violations).toEqual(['update.failed']);
                            });

                            it('renderer is not closed', function () {
                                expect(renderer.close).not.toHaveBeenCalled();
                            });
                        });
                    });
                });
            });
        });
    });
});
