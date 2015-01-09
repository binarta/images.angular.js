describe('image-management', function () {
    var scope, ctrl, directive, rest, notifications, config;
    var $httpBackend;
    var uploader;
    var _file;
    var file;

    beforeEach(module('image-management'));
    beforeEach(module('permissions'));
    beforeEach(module('cache.control'));
    beforeEach(module('notifications'));
    beforeEach(inject(function ($injector, $rootScope) {
        rest = {service: function (it) {
            rest.ctx = it;
        }};
        scope = $rootScope.$new();
        $httpBackend = $injector.get('$httpBackend');
        _file = {
            size: 2000,
            type: 'type',
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
                {actual: 68, expected: 60},
                {actual: 69, expected: 160},
                {actual: 195, expected: 160},
                {actual: 196, expected: 320},
                {actual: 419, expected: 320},
                {actual: 420, expected: 480},
                {actual: 543, expected: 480},
                {actual: 544, expected: 640},
                {actual: 767, expected: 640},
                {actual: 768, expected: 800},
                {actual: 991, expected: 800},
                {actual: 992, expected: 1024},
                {actual: 1200, expected: 1024}
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

                it('with configured lowerbound the nfire notification', function() {
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