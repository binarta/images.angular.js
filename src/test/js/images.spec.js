angular.module('checkpoint', []);
angular.module('rest.client', [])
    .factory('restServiceHandler', function() {
        return jasmine.createSpy('restServiceHandlerSpy');
    });
angular.module('toggle.edit.mode', [])
    .service('editModeRenderer', function () {
        return jasmine.createSpyObj('editModeRenderer', ['open', 'close']);
    });

describe('image-management', function () {
    var scope, ctrl, directive, rest, notifications, config;
    var $httpBackend;
    var uploader;
    var _file;
    var file;
    var imageType;

    beforeEach(module('image-management'));
    beforeEach(module('permissions'));
    beforeEach(module('cache.control'));
    beforeEach(module('notifications'));
    beforeEach(module('toggle.edit.mode'));
    beforeEach(module('uploader.mock'));
    beforeEach(inject(function ($injector, $rootScope) {
        rest = {service: function (it) {
            rest.ctx = it;
        }};
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
    }));
    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    describe('imageManagement service', function () {
        var imageManagement, config, permissionHelper, code, boxWidth, $rootScope;

        beforeEach(inject(function (_imageManagement_, _config_, activeUserHasPermissionHelper, _$rootScope_) {
            imageManagement = _imageManagement_;
            config = _config_;
            permissionHelper = activeUserHasPermissionHelper;
            $rootScope = _$rootScope_;
            config.awsPath = 'http://aws/path/';
            code = 'test.img';
            imageType = 'image-type';
            boxWidth = '100';
        }));

        describe('getImagePath', function () {
            function assertImagePathIsTimestamped () {
                var promise = imageManagement.getImagePath({code: code, width: boxWidth});
                permissionHelper.yes();

                promise.then(function (path) {
                    expect(path).toMatch(/http:\/\/aws\/path\/test.img\?width=160&\d+/);
                });
            }

            describe('with caching enabled', function () {
                beforeEach(function () {
                    config.image = {cache: true};
                });

                describe('and user has no permission', function () {
                    it('image path is not timestamped', function () {
                        var promise = imageManagement.getImagePath({code: code, width: boxWidth});
                        permissionHelper.no();

                        promise.then(function (path) {
                            expect(path).toEqual('http://aws/path/test.img?width=160');
                        });
                    });
                });

                describe('and user has permission', function () {
                    it('image path is timestamped', function () {
                        assertImagePathIsTimestamped();
                    });
                });
            });

            describe('with caching disabled', function () {
                beforeEach(function () {
                    config.image = {cache: false};
                });

                describe('and user has no permission', function () {
                    it('image path is timestamped', function () {
                        assertImagePathIsTimestamped();
                    });
                });

                describe('and user has permission', function () {
                    it('image path is timestamped', function () {
                        assertImagePathIsTimestamped();
                    });
                });
            });
        });

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

            beforeEach(inject(function (_uploader_, $timeout) {
                uploader = _uploader_;

                promise = imageManagement.upload({file: file, code: code, imageType:imageType})
                    .then(function (payload) {
                        expect(payload).toEqual('ok');
                    }, function (reason) {
                        expect(reason).toEqual('reject');
                    }
                );
            }));

            it('pass values to uploader', function () {
                expect(uploader.spy.add.file).toEqual(file);
                expect(uploader.spy.add.path).toEqual(code);
                expect(uploader.spy.add.imageType).toEqual(imageType);
            });

            describe('when upload succeeded', function () {
                beforeEach(function () {
                    uploader.spy.upload.success('ok');
                });

                it('update timestamp of uploaded image on rootScope', function () {
                    expect($rootScope.image.uploaded[code]).toMatch(/\d+/);
                });
            });

            it('when upload failed', function () {
                uploader.spy.upload.rejected('reject');
            });
        });
    });

    describe('image show directive', function () {
        var registry, element, attrs, permitter, dispatcher, topics, imageEvent, loadHandler, errorHandler, abortHandler, rootScope;
        var removedClass, addedClass, parentWidth, cssProperty, cssValue;

        beforeEach(inject(function (activeUserHasPermission, activeUserHasPermissionHelper, topicMessageDispatcher, topicMessageDispatcherMock, $timeout, $rootScope, topicRegistryMock, topicRegistry) {
            permitter = activeUserHasPermissionHelper;
            rootScope = $rootScope;
            scope = $rootScope.$new();
            scope.watches = {};
            removedClass = [];
            scope.$watch = function (expression, callback, b) {
                this.watches[expression] = {};
                this.watches[expression].callback = callback;
                this.watches[expression].weirdBoolean = b;
            };
            ctrl = {
                add: function (data, path) {
                    this.data = data;
                    this.path = path;
                }
            };
            element = {
                fileupload: function (context) {
                    this.context = context;
                },
                find: function (expression) {
                    this.expression = expression;
                    return {
                        click: function () {
                            element.clicked = true;
                        },
                        first: function () {
                            element.first = true;
                            return {
                                bind: function (event, handler) {
                                    imageEvent = event;
                                    if (event == 'load') loadHandler = handler;
                                    if (event == 'error') errorHandler = handler;
                                    if (event == 'abort') abortHandler = handler;
                                },
                                removeClass: function (className) {
                                    removedClass.push(className);
                                },
                                addClass: function (className) {
                                    addedClass = className;
                                }
                            }
                        }
                    };
                },
                parent: function () {
                    return {
                        width: function () {
                            parentWidth = 100;
                        }
                    }
                },
                css: function (property, value) {
                    cssProperty = property;
                    cssValue = value;
                }
            };

            attrs = {};
            registry = topicRegistryMock;
            config = {awsPath: 'base/'};
            dispatcher = topicMessageDispatcher;
            topics = topicMessageDispatcherMock;
            directive = ImageShowDirectiveFactory(config, topicRegistry, activeUserHasPermission, dispatcher, $timeout, $rootScope, function (args) {
                var path = '';
                path += args.cache ? 'cache' : 'no-cache';
                path += ':';
                path += args.path;
                if (parentWidth) {
                    path += '?';
                    path += parentWidth;
                }
                return path;
            });
        }));

        it('restrict', function () {
            expect(directive.restrict).toEqual('E');
        });

        it('controller', function () {
            expect(directive.controller).toEqual(['$scope', 'uploader', 'config', '$rootScope', 'topicMessageDispatcher', 'imagePathBuilder', ImageController]);
        });

        it('default template url', function () {
            expect(directive.templateUrl).toEqual('bower_components/binarta.images.angular/template/image-show.html');
        });

        it('template url with specific components directory', function () {
            config.componentsDir = 'components';
            directive = ImageShowDirectiveFactory(config);

            expect(directive.templateUrl).toEqual('components/binarta.images.angular/template/image-show.html');
        });

        it('scope', function () {
            expect(directive.scope).toEqual({
                path: '@',
                link: '@',
                target: '@',
                alt: '@',
                imageClass: '@',
                width: '@',
                asBackgroundImage: '@'
            });
        });

        var link = function () {
            directive.link(scope, element, attrs, ctrl);
        };

        describe('fire image events', function () {
            var placeholderImage = 'http://cdn.binarta.com/image/placeholder.png';

            beforeEach(function () {
                loadHandler = undefined;
                errorHandler = undefined;
                abortHandler = undefined;
                link();
            });

            it('fires image.loading notification', function () {
                expect(topics['image.loading']).toEqual('loading');
            });

            describe('after interval has passed', function () {

                var waitFor;

                beforeEach(inject(function ($timeout) {
                    waitFor = function (ms) {
                        $timeout.flush(ms);
                    };
                }));

                describe('and working state is still undefined', function () {
                    it('should enable working state after delay', function () {
                        scope.working = undefined;
                        waitFor(1000);

                        expect(scope.working).toEqual(true);
                    });
                });

                describe('and working state is disabled', function () {
                    it('should do nothing', function () {
                        scope.working = false;
                        waitFor(1000);

                        expect(scope.working).toEqual(false);
                    });
                });
            });

            describe('and first img receives load event', function () {
                it('fires loaded notification', function () {
                    loadHandler();

                    expect(element.expression).toEqual('img');
                    expect(element.first).toEqual(true);
                    expect(topics['image.loading']).toEqual('loaded');
                });

                it('disables working state', function () {
                    loadHandler();

                    expect(scope.working).toEqual(false);
                });

                it('removes working class from img', function () {
                    loadHandler();

                    expect(removedClass).toContain('working');
                });

                it('and image is the placeholder, image is not found', function () {
                    scope.imageSource = placeholderImage;
                    loadHandler();

                    expect(scope.notFound).toBeUndefined();
                });

                it('and image is not the placeholder, image is found', function () {
                    scope.imageSource = 'another-source';
                    loadHandler();

                    expect(scope.notFound).toEqual(false);
                    expect(removedClass).toContain('working');
                    expect(removedClass).toContain('not-found');
                });
            });

            it('and first img receives error event', function () {
                errorHandler();

                expect(element.expression).toEqual('img');
                expect(element.first).toEqual(true);
                expect(topics['image.loading']).toEqual('error');
                expect(scope.notFound).toEqual(true);
                expect(addedClass).toEqual('not-found');
                expect(scope.imageSource).toEqual(placeholderImage);
            });

            it('and first img receives abort event', function () {
                abortHandler();

                expect(element.expression).toEqual('img');
                expect(element.first).toEqual(true);
                expect(topics['image.loading']).toEqual('abort');
                expect(scope.notFound).toEqual(true);
                expect(addedClass).toEqual('not-found');
                expect(scope.imageSource).toEqual(placeholderImage);
            });

            describe('testing run method', function () {

                var rootScope, location, path;
                rootScope = {
                    watches: {},
                    $watch: function (expression, callback) {
                        this.watches.expression = expression;
                        this.watches.callback = callback;
                    }
                };
                location = {
                    path: function () {
                        return path;
                    }
                };

                beforeEach(inject(function (topicRegistry) {
                    var run = angular.module('image-management')._runBlocks[0];
                    run[run.length-1](rootScope, location, topicRegistry, dispatcher);
                }));

                it('when all images are loaded fire images.loaded notification', function () {
                    registry['image.loading']('loading');
                    registry['image.loading']('loading');
                    registry['image.loading']('loading');
                    registry['image.loading']('loading');
                    registry['image.loading']('loading');

                    expect(topics['images.loaded']).toBeUndefined();
                    registry['image.loading']('loaded');
                    expect(topics['images.loaded']).toBeUndefined();
                    registry['image.loading']('loaded');
                    expect(topics['images.loaded']).toBeUndefined();
                    registry['image.loading']('error');
                    expect(topics['images.loaded']).toBeUndefined();
                    registry['image.loading']('abort');
                    expect(topics['images.loaded']).toBeUndefined();
                    registry['image.loading']('loaded');
                    expect(topics['images.loaded']).toEqual('ok');
                });

                it('reset image count on path change', function () {
                    registry['image.loading']('loading');
                    registry['image.loading']('loading');
                    path = 'path';
                    rootScope.watches.callback();
                    registry['image.loading']('loaded');
                    registry['image.loading']('loading');
                    registry['image.loading']('loaded');

                    expect(rootScope.watches.expression()).toEqual(path);
                    expect(topics['images.loaded']).toEqual('ok');
                });
            });
        });

        it('on edit mode true and active user has permission editing true', function () {
            link();
            registry['edit.mode'](true);
            permitter.yes();

            expect(scope.editing).toEqual(true);
        });

        it('on edit mode true and active user has permission image.upload editing true', function () {
            link();
            registry['edit.mode'](true);
            permitter.yes();

            expect(scope.editing).toEqual(true);
            expect(permitter.permission).toEqual('image.upload');
        });
        it('on edit mode true and active user has no permission editing false', function () {
            link();
            registry['edit.mode'](true);

            expect(scope.editing).toEqual(false);
        });
        it('on edit mode false and active user has permission editing false', function () {
            link();
            scope.editing = true;
            registry['edit.mode'](false);
            permitter.yes();

            expect(scope.editing).toEqual(false);
        });
        it('on edit mode false and active user has no permission editing false', function () {
            link();
            scope.editing = true;
            registry['edit.mode'](false);
            permitter.no();

            expect(scope.editing).toEqual(false);
        });

        it('linker exposes a linkProvided variable on scope', function () {
            link();
            scope.watches.link.callback();
            expect(scope.linkProvided).toEqual(false);

            scope.link = 'link';
            scope.watches.link.callback();
            expect(scope.linkProvided).toEqual(true);
        });

        it('linker installs fileuploader on element', function () {
            var input = {};
            var data = {
                files: [
                    {name: 'file-name'}
                ]
            };
            scope.path = 'path';

            link();

            expect(element.context.dataType).toEqual('text');
            element.context.add(input, data);
            expect(input.value).toEqual('file-name');
            expect(ctrl.data).toEqual(data);
            expect(ctrl.path).toEqual(scope.path);
        });

        it('linker exposes open function on scope', function () {
            link();
            scope.open();
            expect(element.expression).toEqual("input[type='file']");
            expect(element.clicked).toEqual(true);
        });

        it('linker exposes class attribute on scope', function () {
            attrs.class = 'class';
            link();
            expect(scope.imgClass).toEqual(attrs.class);
        });

        describe('with cacheEnabled scope watcher', function () {
            beforeEach(function () {
                link();
                registry['app.start']();
                scope.path = 'path';
            });

            function triggerWatch() {
                scope.watches['cacheEnabled'].callback();
            }

            it('watch installs image source', function () {
                triggerWatch();
                expect(scope.imageSource).toEqual('base/no-cache:path?100');
            });

            it('cache is disabled when active user has permission', function () {
                rootScope.image.defaultTimeStamp = 'defaultTimeStamp';
                permitter.yes();
                triggerWatch();

                expect(scope.imageSource).toEqual('base/no-cache:path?100');
            });

            it('cache is enabled when active has no permission', function () {
                config.image = {cache: true};
                permitter.no();
                triggerWatch();

                expect(scope.imageSource).toEqual('base/cache:path?100');
            });

            it('cache is enabled when cache enabled flag is on and user has permission and image is newly uploaded', function () {
                config.image = {cache: true};
                permitter.yes();
                rootScope.image.uploaded['path'] = 'timestamp';
                triggerWatch();

                expect(scope.imageSource).toEqual('base/no-cache:path?100');
            });

            it('configure to use the browsers standard image cache mechanism', function () {
                config.image = {cache: true};
                permitter.no();
                triggerWatch();
                expect(scope.imageSource).toEqual('base/cache:path?100');
            });
        });

        describe('with img-class attribute watcher', function () {
            function triggerWatch() {
                scope.watches['imageClass'].callback();
            }

            describe('and no class attribute', function () {
                beforeEach(function () {
                    link();
                    scope.imageClass = 'img-class';
                });

                it("watch is passed a weird boolean I have no idea what it's for", function () {
                    expect(scope.watches['imageClass'].weirdBoolean).toEqual(true);
                });

                it('watch installs image class', function () {
                    triggerWatch();
                    expect(scope.imgClass).toEqual('img-class');
                });
            });

            describe('and class attribute', function () {
                beforeEach(function () {
                    attrs.class = "legacy-class";
                    link();
                    scope.imageClass = 'img-class';
                });

                it('watch appends image class', function () {
                    triggerWatch();
                    expect(scope.imgClass).toEqual('legacy-class img-class');
                });

                describe('and no image-class', function () {
                    beforeEach(function () {
                        attrs.class = "legacy-class";
                        link();
                        scope.imageClass = undefined;
                    });

                    it('watch appends image class', function () {
                        triggerWatch();
                        expect(scope.imgClass).toEqual('legacy-class');
                    });
                });
            });
        });

        describe('when scope is destroyed', function () {
            beforeEach(function () {
                link();
                scope.$destroy();
            });

            it('unsubscribe edit.mode', function () {
                expect(registry['edit.mode']).toBeUndefined();
            });

            it('unsubscribe app.start', function () {
                expect(registry['app.start']).toBeUndefined();
            });
        });

        it('resolve box width from width attribute', function () {
            scope.width = 200;
            link();
            expect(scope.getBoxWidth()).toEqual(200);
        });

        it('when image is not a background image', function () {
            scope.path = 'path';
            link();

            expect(cssProperty).toBeUndefined();
            expect(cssValue).toBeUndefined();
        });

        it('when image is a background image', function () {
            scope.asBackgroundImage = true;
            scope.path = 'path';
            link();

            expect(cssProperty).toEqual('background-image');
            expect(cssValue).toEqual('url("base/no-cache:path?100")');
        });
    });

    describe('binImage directive', function () {
        var scope, element, event, directive, imageManagement, addedClass, removedClass;
        var imagePath = 'image/path.jpg';

        beforeEach(inject(function ($rootScope, $q) {
            scope = $rootScope.$new();

            scope.bindImageEvents = jasmine.createSpy('bindImageEvents');
            scope.bindClickEvent = jasmine.createSpy('bindClickEvent');

            addedClass = [];
            removedClass = [];
            event = [];
            element = {
                parent: function () {
                    return {
                        width: function () {
                            return 0;
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
                getImagePathSpy: {},
                getImagePath: function (args) {
                    imageManagement.getImagePathSpy = args;
                    var deferred = $q.defer();
                    deferred.resolve(imagePath);
                    return deferred.promise;
                }
            };

            directive = BinImageDirectiveFactory(imageManagement);
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
                directive.link(scope, element, {binImage: 'test.img'});
                scope.$digest();
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
                expect(imageManagement.getImagePathSpy).toEqual({code: 'test.img', width: 100});
                expect(element[0].src).toEqual(imagePath);
            });

            it('update image src', function () {
                scope.setImageSrc('test');

                expect(element[0].src).toEqual('test');
            });

            describe('with width attribute on image', function () {
                beforeEach(function () {
                    directive.link(scope, element, {binImage: 'test.img', width: '200'});
                    scope.$digest();
                });

                it('get image path', function () {
                    expect(imageManagement.getImagePathSpy).toEqual({code: 'test.img', width: 200});
                });
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
    });

    describe('binBackgroundImage directive', function () {
        var scope, element, directive, imageManagement, cssSpy, getImagePathDeferred, bindImageEventsDeferred;
        var imagePath = 'image/path.jpg';

        beforeEach(inject(function ($rootScope, $q) {
            scope = $rootScope.$new();

            bindImageEventsDeferred = $q.defer();
            scope.bindImageEvents = jasmine.createSpy('bindImageEvents').andReturn(bindImageEventsDeferred.promise);
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

            getImagePathDeferred = $q.defer();
            imageManagement = {
                getImagePath: jasmine.createSpy('getImagePath').andReturn(getImagePathDeferred.promise)
            };

            directive = BinBackgroundImageDirectiveFactory(imageManagement);
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
                directive.link(scope, element, {binBackgroundImage: 'test.img'});
                scope.$digest();
            });

            it('put code on scope', function () {
                expect(scope.code).toEqual('test.img');
            });

            it('get image path', function () {
                expect(imageManagement.getImagePath).toHaveBeenCalledWith({code: 'test.img', width: 100});
            });

            describe('on get image path success', function () {
                beforeEach(function () {
                    getImagePathDeferred.resolve(imagePath);
                    scope.$digest();
                });

                it('bind image events', function () {
                    expect(scope.bindImageEvents).toHaveBeenCalledWith({
                        bindOn: jasmine.any(Object)
                    });
                });

                describe('on success', function () {
                    beforeEach(function () {
                        bindImageEventsDeferred.resolve();
                        scope.$digest();
                    });

                    it('set background image', function () {
                        expect(cssSpy).toEqual({
                            key: 'background-image',
                            value: 'url("'+ imagePath + '")'
                        });
                    });
                });
            });

            it('update image src', function () {
                scope.setImageSrc('test');

                expect(cssSpy).toEqual({
                    key: 'background-image',
                    value: 'url(test)'
                });
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
    });

    describe('binImageController', function () {
        var scope, element, event, editModeRenderer, editModeRendererSpy, imageManagement, addedClass, removedClass, permitter, registry, $window;
        var imagePath = 'image/path.jpg';

        beforeEach(inject(function ($rootScope, $q, activeUserHasPermission, activeUserHasPermissionHelper, ngRegisterTopicHandler, topicRegistryMock, _$window_) {
            scope = $rootScope.$new();

            scope.setImageSrc = function (src) {
                scope.setImageSrcSpy = src;
            };

            scope.setDefaultImageSrc = function () {
                scope.setDefaultImageSrcCalled = true;
            };

            scope.code = 'test.img';

            permitter = activeUserHasPermissionHelper;
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
                is: function () {}
            };

            registry = topicRegistryMock;

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
                }
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

            BinImageController(scope, element, $q, imageManagement, editModeRenderer, activeUserHasPermission, ngRegisterTopicHandler, $window);
        }));

        it('is in working state', function () {
            expect(scope.state).toEqual('working');
        });

        describe('bind image events', function () {
            describe('and no args given', function () {
                var resolved, rejected;

                beforeEach(function () {
                    scope.bindImageEvents().then(function () {
                        resolved = true;
                    }, function () {
                        rejected = true;
                    });
                    scope.$digest();
                });

                describe('when image not found', function () {
                    beforeEach(function () {
                        event['error']();
                    });

                    it('put not-found class on element', function () {
                        expect(addedClass[1]).toEqual('not-found');
                    });

                    it('remove working class from element', function () {
                        expect(removedClass[0]).toEqual('working');
                    });

                    it('set state on scope', function () {
                        expect(scope.state).toEqual('not-found');
                    });

                    it('promise is rejected', function () {
                        expect(rejected).toBeTruthy();
                    });
                });

                describe('when image aborted', function () {
                    beforeEach(function () {
                        event['abort']();
                    });

                    it('put not-found class on element', function () {
                        expect(addedClass[1]).toEqual('not-found');
                    });

                    it('remove working class from element', function () {
                        expect(removedClass[0]).toEqual('working');
                    });

                    it('set state on scope', function () {
                        expect(scope.state).toEqual('not-found');
                    });

                    it('promise is rejected', function () {
                        expect(rejected).toBeTruthy();
                    });
                });

                describe('when image is found', function () {
                    beforeEach(function () {
                        event['load']();
                    });

                    it('put not-found class on element', function () {
                        expect(removedClass[0]).toEqual('not-found');
                    });

                    it('remove working class from element', function () {
                        expect(removedClass[1]).toEqual('working');
                    });

                    it('set state on scope', function () {
                        expect(scope.state).toEqual('loaded');
                    });

                    it('promise is rejected', function () {
                        expect(resolved).toBeTruthy();
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
            beforeEach(function () {
                scope.bindClickEvent();
            });

            describe('when user has permission', function () {
                beforeEach(function () {
                    permitter.yes();
                });

                it('for image.upload', function () {
                    expect(permitter.permission).toEqual('image.upload');
                });

                describe('and edit.mode true bindEvent received', function () {
                    beforeEach(function () {
                        registry['edit.mode'](true);
                    });

                    it('bind element to click bindEvent', function () {
                        expect(event['click']).toBeDefined();
                    });

                    describe('and element is clicked', function () {
                        var clickResponse;

                        describe('with overridden edit click event', function () {
                            beforeEach(function () {
                                scope.onEdit = jasmine.createSpy('onEdit');
                            });

                            describe('and image is loaded', function () {
                                beforeEach(function () {
                                    scope.state = 'loaded';
                                    clickResponse = event['click']();
                                });

                                it('custom event is triggered', function () {
                                    expect(scope.onEdit).toHaveBeenCalledWith({isFirstImage : false});
                                });
                            });

                            describe('and image is not found', function () {
                                beforeEach(function () {
                                    scope.state = 'not-found';
                                    clickResponse = event['click']();
                                });

                                it('custom event is triggered', function () {
                                    expect(scope.onEdit).toHaveBeenCalledWith({isFirstImage : true});
                                });
                            });
                        });

                        describe('default', function () {
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
                                        expect(editModeRendererSpy.open.template).toEqual(jasmine.any(String));
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

                                    describe('on submit without image type', function() {
                                        var matchOn;

                                        beforeEach(function() {
                                            element.is = function (m) {
                                                matchOn = m;
                                                return true;
                                            };

                                            editModeRendererSpy.open.scope.submit();
                                        });

                                        it('check if img', function () {
                                            expect(matchOn).toEqual('img');
                                        });

                                        it('test', function() {
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
                });

                describe('and edit.mode false bindEvent received', function () {
                    beforeEach(function () {
                        registry['edit.mode'](false);
                    });

                    it('unbind element from click bindEvent', function () {
                        expect(event['click']).toBeUndefined();
                    });
                });
            });

            describe('when user has no permission', function () {
                beforeEach(function () {
                    permitter.no();
                });

                it('unbind element from click bindEvent', function () {
                    expect(event['click']).toBeUndefined();
                });
            });
        });
    });

    describe('binImagesController', function () {
        var $rootScope, $q, ctrl, restHandler, editModeRenderer, imageManagement, uploadDeferred;
        var initDeferred;
        var partition = '/test/partition/';

        beforeEach(inject(function (_$rootScope_, $controller, _$q_, restServiceHandler, config, _editModeRenderer_, _imageManagement_) {
            $q = _$q_;
            $rootScope = _$rootScope_;
            editModeRenderer = _editModeRenderer_;
            restHandler = restServiceHandler;
            imageManagement = _imageManagement_;
            imageManagement.fileUpload = jasmine.createSpy('fileupload');
            imageManagement.triggerFileUpload = jasmine.createSpy('triggerFileUpload');
            uploadDeferred = $q.defer();
            imageManagement.upload = jasmine.createSpy('upload').andReturn(uploadDeferred.promise);
            imageManagement.validate = jasmine.createSpy('validate');

            config.namespace = 'namespace';
            config.baseUri = 'baseUri/';
            config.awsPath = 'awsPath/';

            initDeferred = $q.defer();
            restHandler.andReturn(initDeferred.promise);

            ctrl = $controller('binImagesController');
        }));

        describe('with partition', function () {
            beforeEach(function () {
                ctrl.init({
                    partition: partition
                });
            });

            it('get images', function () {
                expect(restHandler).toHaveBeenCalledWith({
                    params: {
                        data: {
                            args: {
                                namespace: 'namespace',
                                partition: '/test/partition/',
                                sortings: [{
                                    on: "priority",
                                    orientation: "asc"
                                }],
                                subset: {
                                    count: 10,
                                    offset: 0
                                },
                                type: "images"
                            },
                            locale: 'default'
                        },
                        headers: {
                            "accept-language": "default"
                        },
                        method: "POST",
                        url: 'baseUri/api/query/catalog-item/search',
                        withCredentials: true
                    }
                });
            });

            describe('on success', function () {
                describe('when empty results', function () {
                    beforeEach(function () {
                        initDeferred.resolve({
                            data: []
                        });
                        $rootScope.$digest();
                    });

                    it('only default image', function () {
                        expect(ctrl.images).toEqual([{
                            id: partition + '0',
                            path: 'carousels' + partition + '0.img'
                        }]);
                    });
                });

                describe('with one result', function () {
                    beforeEach(function () {
                        initDeferred.resolve({
                            data: [{id: '/id'}]
                        });
                        $rootScope.$digest();
                    });

                    it('data is available on controller', function () {
                        expect(ctrl.images).toEqual([{id: '/id', path: 'carousels/id.img'}]);
                    });
                });
            });
        });

        describe('with partition and limit', function () {
            beforeEach(function () {
                ctrl.init({
                    partition: partition,
                    limit: 1
                });
            });

            it('get images', function () {
                expect(restHandler.calls[0].args[0].params.data.args.subset.count).toEqual(1);
            });
        });

        describe('on open', function () {
            var scope, getRemainingItemsDeferred;

            beforeEach(function () {
                ctrl.init({
                    partition: partition
                });
            });

            describe('no catalog items', function () {
                beforeEach(function () {
                    initDeferred.resolve({
                        data: []
                    });
                    $rootScope.$digest();

                    getRemainingItemsDeferred = $q.defer();
                    restHandler.andReturn(getRemainingItemsDeferred.promise);
                });

                describe('and no image files', function () {
                    beforeEach(function () {
                        ctrl.open({isFirstImage: true});

                        getRemainingItemsDeferred.resolve({
                            data: []
                        });
                        $rootScope.$digest();

                        scope = editModeRenderer.open.calls[0].args[0].scope;
                    });

                    it('isFirstImage is on scope', function () {
                        expect(scope.isFirstImage).toBeTruthy();
                    });

                    it('file-upload is triggered', function () {
                        expect(imageManagement.triggerFileUpload).toHaveBeenCalled();
                    });

                    describe('on file selected', function () {
                        var addCatalogItemDeferred;

                        beforeEach(function () {
                            addCatalogItemDeferred = $q.defer();
                            restHandler.andReturn(addCatalogItemDeferred.promise);

                            imageManagement.fileUpload.calls[0].args[0].add(null, {});
                        });

                        it('catalog item is created', function () {
                            expect(restHandler).toHaveBeenCalledWith({
                                params: {
                                    data: {
                                        type: 'images',
                                        partition: partition,
                                        locale: 'default',
                                        namespace: 'namespace',
                                        defaultName: 'image'
                                    },
                                    method: "PUT",
                                    url: 'baseUri/api/entity/catalog-item',
                                    withCredentials: true
                                }
                            });
                        });

                        describe('on success', function () {
                            beforeEach(function () {
                                imageManagement.validate.andReturn([]);

                                addCatalogItemDeferred.resolve({
                                    data: {
                                        id: partition + 'new'
                                    }
                                });
                                $rootScope.$digest();
                            });

                            describe('file is uploaded', function () {
                                beforeEach(function () {
                                    uploadDeferred.resolve();
                                    $rootScope.$digest();
                                });

                                it('set isFirstImage to false', function () {
                                    expect(scope.isFirstImage).toBeFalsy();
                                });

                                it('default image is replaced', function () {
                                    expect(ctrl.images).toEqual([{
                                        id : partition + 'new',
                                        path : 'carousels' + partition + 'new.img'
                                    }]);
                                });
                            });
                        });
                    });
                });

                describe('and first image file exists', function () {
                    var addFirstImageDeferred;

                    beforeEach(function () {
                        ctrl.open();
                        addFirstImageDeferred = $q.defer();
                        restHandler.andReturn(addFirstImageDeferred.promise);

                        getRemainingItemsDeferred.resolve({
                            data: []
                        });
                        $rootScope.$digest();

                        scope = editModeRenderer.open.calls[0].args[0].scope;
                    });

                    it('awsPath is on scope', function () {
                        expect(scope.awsPath).toEqual('awsPath/');
                    });

                    describe('add catalog item for first image', function () {
                        it('create default catalog item', function () {
                            expect(restHandler).toHaveBeenCalledWith({
                                params: {
                                    data: {
                                        type: 'images',
                                        partition: partition,
                                        locale: 'default',
                                        namespace: 'namespace',
                                        defaultName: 'image',
                                        name: '0'
                                    },
                                    method: "PUT",
                                    url: 'baseUri/api/entity/catalog-item',
                                    withCredentials: true
                                }
                            });
                        });

                        describe('on success', function () {
                            var item = {
                                entity: 'catalog-item',
                                id: partition + '0',
                                path: 'carousels' + partition + '0.img'
                            };

                            beforeEach(function () {
                                addFirstImageDeferred.resolve({
                                    data: {
                                        entity: 'catalog-item',
                                        id: partition + '0'
                                    }
                                });
                                $rootScope.$digest();
                            });

                            it('image is on controller', function () {
                                expect(ctrl.images).toEqual([item]);
                            });
                        });
                    });
                });
            });

            describe('with catalog items', function () {
                beforeEach(inject(function ($templateCache) {
                    $templateCache.put('images-bin-images-ctrl-clerk.html','template');

                    initDeferred.resolve({
                        data: [{
                            id: '/image1',
                            priority: 1
                        }, {
                            id: '/image2',
                            priority: 2
                        }]
                    });
                    $rootScope.$digest();
                    getRemainingItemsDeferred = $q.defer();
                    restHandler.andReturn(getRemainingItemsDeferred.promise);

                    ctrl.open();

                    getRemainingItemsDeferred.resolve({
                        data: []
                    });
                    $rootScope.$digest();
                }));

                it('remaining items are requested', function () {
                    expect(restHandler.calls[1].args[0].params.data.args.subset.count).toEqual(8);
                    expect(restHandler.calls[1].args[0].params.data.args.subset.offset).toEqual(2);
                });

                it('images are on controller', function () {
                    expect(ctrl.images).toEqual([{
                        id: '/image1',
                        priority: 1,
                        path: 'carousels/image1.img'
                    }, {
                        id: '/image2',
                        priority: 2,
                        path: 'carousels/image2.img'
                    }]);
                });

                it('editModeRenderer is opened', function () {
                    expect(editModeRenderer.open).toHaveBeenCalledWith({
                        template: 'template',
                        scope: jasmine.any(Object)
                    });
                });

                describe('with renderer scope', function () {
                    beforeEach(function () {
                        scope = editModeRenderer.open.calls[0].args[0].scope;
                    });

                    it('images are on scope', function () {
                        expect(scope.images).toEqual(ctrl.images);
                    });

                    describe('on add image', function () {
                        beforeEach(function () {
                            scope.addImage();
                        });

                        it('file upload is triggered', function () {
                            expect(imageManagement.fileUpload).toHaveBeenCalledWith({
                                dataType: 'json',
                                add: jasmine.any(Function)
                            });
                            expect(imageManagement.triggerFileUpload).toHaveBeenCalled();
                        });

                        describe('on add file', function () {
                            var file = 'file';
                            var addCatalogItemDeferred;

                            beforeEach(function () {
                                addCatalogItemDeferred = $q.defer();
                                restHandler.andReturn(addCatalogItemDeferred.promise);

                                imageManagement.fileUpload.calls[0].args[0].add(null, file);
                            });

                            it('create new catalog item', function () {
                                expect(restHandler).toHaveBeenCalledWith({
                                    params: {
                                        data: {
                                            type: 'images',
                                            partition: partition,
                                            locale: 'default',
                                            namespace: 'namespace',
                                            defaultName: 'image'
                                        },
                                        method: "PUT",
                                        url: 'baseUri/api/entity/catalog-item',
                                        withCredentials: true
                                    }
                                });
                            });

                            describe('on catalog item created', function () {
                                describe('and image is invalid', function () {
                                    beforeEach(function () {
                                        imageManagement.validate.andReturn(['invalid']);
                                        addCatalogItemDeferred.resolve({
                                            data: {
                                                id: partition + 'new'
                                            }
                                        });
                                        $rootScope.$digest();
                                    });

                                    it('image is validated', function () {
                                        expect(imageManagement.validate).toHaveBeenCalledWith(file);
                                    });

                                    it('do not upload image', function () {
                                        expect(imageManagement.upload).not.toHaveBeenCalled();
                                    });

                                    it('violations are on scope', function () {
                                        expect(scope.violations).toEqual(['invalid']);
                                    });

                                    it('delete catalog item', function () {
                                        expect(restHandler).toHaveBeenCalledWith({
                                            params: {
                                                method: 'DELETE',
                                                url: 'baseUri/api/entity/catalog-item?id=' + encodeURIComponent(partition + 'new'),
                                                withCredentials: true
                                            }
                                        });
                                    });
                                });

                                describe('and image is valid', function () {
                                    beforeEach(function () {
                                        imageManagement.validate.andReturn([]);
                                        addCatalogItemDeferred.resolve({
                                            data: {
                                                id: partition + 'new'
                                            }
                                        });
                                        $rootScope.$digest();
                                    });

                                    it('upload image', function () {
                                        expect(imageManagement.upload).toHaveBeenCalledWith({
                                            file: file,
                                            code: 'carousels' + partition + 'new.img',
                                            imageType: 'foreground'
                                        });

                                        expect(scope.uploading).toBeTruthy();
                                    });

                                    describe('on upload success', function () {
                                        beforeEach(function () {
                                            uploadDeferred.resolve();
                                            $rootScope.$digest();
                                        });

                                        it('add new image to scope', function () {
                                            expect(ctrl.images).toEqual([{
                                                id: '/image1',
                                                priority: 1,
                                                path: 'carousels/image1.img'
                                            }, {
                                                id: '/image2',
                                                priority: 2,
                                                path: 'carousels/image2.img'
                                            }, {
                                                id: partition + 'new',
                                                path: 'carousels' + partition + 'new.img'
                                            }]);
                                            expect(scope.uploading).toBeFalsy();
                                        });
                                    });

                                    describe('on upload failed', function () {
                                        beforeEach(function () {
                                            uploadDeferred.reject();
                                            $rootScope.$digest();
                                        });

                                        it('put violations on scope', function () {
                                            expect(scope.violations).toEqual(['upload.failed']);
                                        });

                                        it('delete catalog item', function () {
                                            expect(restHandler).toHaveBeenCalledWith({
                                                params: {
                                                    method: 'DELETE',
                                                    url: 'baseUri/api/entity/catalog-item?id=' + encodeURIComponent(partition + 'new'),
                                                    withCredentials: true
                                                }
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });

                    it('on open image', function () {
                        scope.openImage('image');

                        expect(scope.openedImage).toEqual('image');
                    });

                    it('on close image', function () {
                        scope.openImage('image');
                        scope.closeImage();

                        expect(scope.openedImage).toBeUndefined();
                    });

                    describe('on delete image', function () {
                        var deleteImageDeferred;

                        beforeEach(function () {
                            deleteImageDeferred = $q.defer();
                            restHandler.andReturn(deleteImageDeferred.promise);

                            scope.openedImage = 'image';
                        });

                        describe('when only one image', function () {
                            beforeEach(function () {
                                ctrl.images = [{id: 'id'}];
                                scope.deleteImage(ctrl.images[0]);
                            });

                            it('put violations on scope', function () {
                                expect(scope.violations).toEqual(['images.lowerbound']);
                            });
                        });

                        describe('when more than one image', function () {
                            beforeEach(function () {
                                ctrl.images = [{id: 'id1'}, {id: 'id2'}];
                                scope.deleteImage(ctrl.images[0]);
                            });

                            it('delete catalog item', function () {
                                expect(restHandler).toHaveBeenCalledWith({
                                    params: {
                                        method: 'DELETE',
                                        url: 'baseUri/api/entity/catalog-item?id=id1',
                                        withCredentials: true
                                    }
                                });
                            });

                            describe('on delete success', function () {
                                beforeEach(function () {
                                    deleteImageDeferred.resolve();
                                    $rootScope.$digest();
                                });

                                it('remove item from images', function () {
                                    expect(ctrl.images).toEqual([{id: 'id2'}]);
                                });

                                it('image is closed', function () {
                                    expect(scope.openedImage).toBeUndefined();
                                });
                            });
                        });
                    });

                    it('on close', function () {
                        scope.close();

                        expect(editModeRenderer.close).toHaveBeenCalled();
                    });
                });
            });

            describe('with max amount of catalog items', function () {
                beforeEach(inject(function ($templateCache) {
                    $templateCache.put('images-bin-images-ctrl-clerk.html', 'template');

                    initDeferred.resolve({
                        data: [{
                            id: '/image1',
                            priority: 1
                        }, {
                            id: '/image2',
                            priority: 2
                        },{
                            id: '/image1',
                            priority: 3
                        }, {
                            id: '/image2',
                            priority: 4
                        },{
                            id: '/image1',
                            priority: 5
                        }, {
                            id: '/image2',
                            priority: 6
                        },{
                            id: '/image1',
                            priority: 7
                        }, {
                            id: '/image2',
                            priority: 8
                        },{
                            id: '/image1',
                            priority: 9
                        }, {
                            id: '/image2',
                            priority: 10
                        }
                        ]
                    });
                    $rootScope.$digest();
                    getRemainingItemsDeferred = $q.defer();
                    restHandler.andReturn(getRemainingItemsDeferred.promise);

                    ctrl.open();

                    getRemainingItemsDeferred.resolve({
                        data: []
                    });
                    $rootScope.$digest();

                    scope = editModeRenderer.open.calls[0].args[0].scope;
                }));

                describe('on add image', function () {
                    beforeEach(function () {
                        scope.addImage();
                    });

                    it('file upload is not triggered', function () {
                        expect(imageManagement.fileUpload).not.toHaveBeenCalled();
                        expect(imageManagement.triggerFileUpload).not.toHaveBeenCalled();
                    });

                    it('put violation on scope', function () {
                        expect(scope.violations).toEqual(['images.upperbound']);
                    });
                });

            });
        });

    });

    describe('ImagePathBuilder', function () {
        var builder;
        var args = {};

        beforeEach(inject(function (imagePathBuilder, $rootScope) {
            builder = imagePathBuilder;
            args.path = 'P';
            $rootScope.image = {uploaded: {}, defaultTimeStamp: 'D'};
        }));

        function testImagePath(timestamp) {
            [
                {actual: 0, expected: 60},
                {actual: 1, expected: 60},
                {actual: 60, expected: 60},
                {actual: 61, expected: 160},
                {actual: 160, expected: 160},
                {actual: 161, expected: 320},
                {actual: 320, expected: 320},
                {actual: 321, expected: 480},
                {actual: 480, expected: 480},
                {actual: 481, expected: 768},
                {actual: 768, expected: 768},
                {actual: 769, expected: 992},
                {actual: 992, expected: 992},
                {actual: 993, expected: 1200},
                {actual: 1200, expected: 1200},
                {actual: 1201, expected: 1920},
                {actual: 1920, expected: 1920},
                {actual: 1921, expected: 4096},
                {actual: 4096, expected: 4096}
            ].forEach(function (value) {
                    describe('and parent width ' + value.actual + ' is given', function () {
                        it('then width ' + value.expected + ' is appended', function () {
                            args.parentWidth = value.actual;
                            var path = builder(args);
                            var ts = timestamp ? '&' + timestamp : '';
                            expect(path).toEqual(args.path + '?width=' + value.expected + ts);
                        });
                    });
                });
        }

        describe('when path starts with a slash', function () {
            beforeEach(function () {
                args.path = '///P';
            });

            it('strip leading slash', function () {
                expect(builder(args)).toEqual('P?D');
            });
        });

        describe('with cache enabled', function () {
            beforeEach(function () {
                args.cache = true;
            });

            testImagePath();

            describe('and image was uploaded then image timestamp gets appended', function () {
                var timestamp = 'T';

                beforeEach(inject(function ($rootScope) {
                    $rootScope.image.uploaded[args.path] = timestamp;
                }));

                testImagePath(timestamp);
            });
        });

        describe('with cache disabled', function () {
            beforeEach(function () {
                args.cache = false;
            });

            describe('and no image uploaded then use default timestamp', function () {
                var timestamp = 'D';
                testImagePath(timestamp);
            });

            describe('and image uploaded then use image timestamp', function () {
                var timestamp = 'TT';

                beforeEach(inject(function ($rootScope) {
                    $rootScope.image.uploaded[args.path] = timestamp;
                }));

                testImagePath(timestamp);
            });
        });
    });

    describe('ImageController', function () {
        var awsPath = 'path';
        var path = 'path';
        var rootScope, dispatcherMock, topics, backgroundImagePath;

        beforeEach(inject(function ($rootScope, $controller, cacheControl) {
            config = {awsPath: awsPath};
            rootScope = $rootScope;
            dispatcherMock = {
                fire: function (topic, message) {
                    topics.push({topic: topic, message: message});
                }
            };
            topics = [];
            uploader = {
                add: function (file, path) {
                    uploader.file = file.files[0];
                    uploader.path = path;
                },
                upload: function (handlers) {
                    uploader.handlers = handlers;
                    return uploader;
                },
                success: function (it) {
                    uploader.onSuccess = it;
                    return uploader;
                },
                error: function (it) {
                    uploader.onError = it;
                    return uploader;
                }
            };
            scope.getBoxWidth = function () {
                return 100;
            };
            scope.updateBackgroundImage = function (path) {
                backgroundImagePath = path;
            };
            ctrl = $controller(ImageController, {
                $scope: scope,
                config: config,
                uploader: uploader,
                $templateCache: {removeAll: function () {
                    cacheControl.cleared = true;
                }},
                topicMessageDispatcher: dispatcherMock,
                imagePathBuilder: function () {
                    return rootScope.image.uploaded[uploader.path];
                }
            })
        }));

        it('init', function () {
            expect(scope.error).toBeFalsy();
            expect(scope.selecting).toEqual(false);
            expect(scope.hasError).toEqual(false);
        });

        it('on select enter selecting mode', function () {
            scope.select();
            expect(scope.selecting).toEqual(true);
        });

        it('cancel editing mode', function () {
            scope.selecting = true;
            scope.cancel();
            expect(scope.selecting).toEqual(false);
        });

        describe('adding a file to the uploader', function() {
            beforeEach(function() {
                ctrl.add(file, path);
            });

            it('populates scope', function() {
                expect(scope.name).toEqual(_file.name);
                expect(scope.canUpload).toEqual(true);
                expect(uploader.file).toEqual(_file);
                expect(uploader.path).toEqual(path);
            });

            describe('under the size limit', function() {
                beforeEach(function() {
                    file.files[0].size = 1023;
                    ctrl.add(file, path);
                });

                it('fire notification', function() {
                    expect(scope.hasError).toBeTruthy();
                    expect(topics).toEqual([
                        {
                            topic: 'system.warning',
                            message: {
                                code: 'contentLength.lowerbound',
                                default: 'contentLength.lowerbound'
                            }
                        }
                    ])
                });

                it('with configured lowerbound then fire notification', function() {
                    topics = [];
                    config.image = {upload: { lowerbound: 10}};
                    file.files[0].size = 9;
                    ctrl.add(file, path);

                    expect(scope.hasError).toBeTruthy();
                    expect(topics).toEqual([
                        {
                            topic: 'system.warning',
                            message: {
                                code: 'contentLength.lowerbound',
                                default: 'contentLength.lowerbound'
                            }
                        }
                    ])
                })

            });

            describe('above the size limit', function() {
                beforeEach(function() {
                    file.files[0].size = 10485761;
                    ctrl.add(file, path);
                });

                it('then execute rejection', function() {
                    expect(scope.hasError).toBeTruthy();
                    expect(topics).toEqual([
                        {
                            topic: 'system.warning',
                            message: {
                                code: 'contentLength.upperbound',
                                default: 'contentLength.upperbound'
                            }
                        }
                    ])
                });

                it('with configured upperbound then execute rejection', function() {
                    topics = [];
                    config.image = {upload: { upperbound: 2000}};
                    file.files[0].size = 2001;
                    ctrl.add(file, path);

                    expect(scope.hasError).toBeTruthy();
                    expect(topics).toEqual([
                        {
                            topic: 'system.warning',
                            message: {
                                code: 'contentLength.upperbound',
                                default: 'contentLength.upperbound'
                            }
                        }
                    ])
                })


            });
        });

        it('loading gets set to true until response is received', function () {
            ctrl.add(file, path);

            scope.upload();

            expect(scope.loading).toBeTruthy();
            uploader.handlers.success('payload', 201);
            expect(scope.loading).toBeFalsy()
        });

        it('can upload is disabled when on submit', function () {
            scope.upload();
            expect(scope.canUpload).toEqual(false);
        });

        describe('', function () {
            beforeEach(function () {
                config.autoUpload = true;
                scope.selecting = true;
                ctrl.add(file, path);
            });

            it('test', function () {
                expect(uploader.handlers).toBeDefined();
            })
        });

        describe('on upload success', function () {
            describe('and image is not a background image', function () {
                beforeEach(function () {
                    scope.selecting = true;
                    ctrl.add(file, path);
                    scope.upload();
                    uploader.handlers.success('payload', 201);
                });

                it('refresh image source', function () {
                    expect(scope.name).toEqual('');
                    expect(scope.imageSource).toContain(awsPath + rootScope.image.uploaded[uploader.path]);
                    expect(scope.status).toEqual(201);
                    expect(scope.selecting).toEqual(false);
                });

                it('keep reference of newly uploaded image on rootScope', function () {
                    expect(rootScope.image.uploaded[uploader.path]).toMatch(/\d+/);
                });

                it('update background image is not called', function () {
                    expect(backgroundImagePath).toBeUndefined();
                });
            });

            describe('and image is a background image', function () {
                beforeEach(function () {
                    scope.selecting = true;
                    scope.asBackgroundImage = true;
                    ctrl.add(file, path);
                    scope.upload();
                    uploader.handlers.success('payload', 201);
                });

                it('update background image is called', function () {
                    expect(backgroundImagePath).toEqual(scope.imageSource);
                });
            });
        });

        it('upload with rejected', function () {
            ctrl.add(file, path);

            scope.upload();
            uploader.handlers.rejected({"contentType": ['whitelist']});

            expect(scope.loading).toBeFalsy();
            expect(scope.hasError).toEqual(true);
        });

        it('reset violations on submit', function () {
            scope.hasError = true;
            scope.upload();
            expect(scope.hasError).toEqual(false);
        });

        it('fires violation notifications', function () {
            scope.upload();
            uploader.handlers.rejected({"contentType": ['violation1', 'violation2']});

            expect(topics).toEqual([
                {
                    topic: 'system.warning',
                    message: {
                        code: 'contentType.violation1',
                        default: 'contentType.violation1'
                    }
                },
                {
                    topic: 'system.warning',
                    message: {
                        code: 'contentType.violation2',
                        default: 'contentType.violation2'
                    }
                }
            ]);
        });
    });

    describe('ImageUploadDialogController', function () {
        beforeEach(inject(function ($controller, config) {
            config.awsPath = 'http://aws/';
            ctrl = $controller(ImageUploadDialogController, {$scope: scope});
        }));

        it('open dialog', inject(function ($modal) {
            ctrl.open();
            $modal.opened.once();
            $modal.opened.templateUrl('partials/image/upload.modal.html');
            $modal.opened.backdrop('static');
            $modal.opened.scope(scope);
        }));

        it('an initial image source is generated', inject(function (config) {
            ctrl.open();
            expect(scope.imgSrc).toEqual('images/redacted/v4-uuid.img');
        }));

        it('set image source', inject(function (config) {
            ctrl.open();
            ctrl.source(config.awsPath + 's');
            expect(scope.imgSrc).toEqual('s');
        }));

        it('remove anchors when sourcing an image', inject(function (config) {
            ctrl.open();
            ctrl.source(config.awsPath + 's#anchor');
            expect(scope.imgSrc).toEqual('s');
        }));

        it('remove query params when sourcing an image', inject(function (config) {
            ctrl.open();
            ctrl.source(config.awsPath + 's?params');
            expect(scope.imgSrc).toEqual('s');
        }));

        it('accepting an image', inject(function (config) {
            ctrl.open({
                accept: function (src) {
                    expect(src.replace(/\?.*/, '')).toEqual(config.awsPath + scope.imgSrc);
                }
            });
            scope.accept();
        }));

        it('accepting an existing image', inject(function (config) {
            ctrl.source('s');
            ctrl.open({
                accept: function (src) {
                    expect(src.replace(/\?.*/, '')).toEqual(config.awsPath + 's');
                }
            });
            scope.accept();
        }));
    });
});