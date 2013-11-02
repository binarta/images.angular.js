describe('image-management', function () {
    var scope, ctrl, directive, rest, notifications, config;
    var $httpBackend;
    var uploader;
    var _file = {
        size: 1,
        type: 'type',
        name: 'name'
    }
    var file = {
        files: [_file]
    }

    beforeEach(module('image-management'));
    beforeEach(module('permissions'));
    beforeEach(module('cache.control'));
    beforeEach(inject(function ($injector, $rootScope) {
        rest = {service: function (it) {
            rest.ctx = it;
        }};
        scope = $rootScope.$new();
        $httpBackend = $injector.get('$httpBackend');
        notifications = {
            subscribe: function (topic, callback) {
                notifications[topic] = callback;
            }
        };
    }));
    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    describe('image show directive', function () {
        var registry, element, attrs, permitter;

        beforeEach(inject(function (activeUserHasPermission, activeUserHasPermissionHelper) {
            permitter = activeUserHasPermissionHelper;
            scope = {
                watches: {},
                $watch: function (expression, callback, b) {
                    this.watches[expression] = {};
                    this.watches[expression].callback = callback;
                    this.watches[expression].weirdBoolean = b;
                }
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
                        }
                    };
                }
            };
            attrs = {};
            registry = {
                subscribe: function (topic, callback) {
                    registry[topic] = callback;
                }
            };
            config = {awsPath: 'base/'};
            directive = ImageShowDirectiveFactory(config, registry, activeUserHasPermission);
        }));

        it('restrict', function () {
            expect(directive.restrict).toEqual('E');
        });

        it('controller', function () {
            expect(directive.controller).toEqual(['$scope', 'uploader', 'config', '$templateCache', ImageController]);
        });

        it('template url', function () {
            expect(directive.templateUrl).toEqual('app/partials/image/show.html');
        });

        it('scope', function () {
            expect(directive.scope).toEqual({
                path: '@',
                link: '@',
                alt: '@',
                imageClass: '@'
            });
        });

        var link = function () {
            directive.link(scope, element, attrs, ctrl);
        };

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

        describe('with path attribute watcher', function () {
            beforeEach(function () {
                link();
                scope.path = 'path';
            });

            function triggerWatch() {
                scope.watches['path'].callback();
            }

            it("watch is passed a weird boolean I have no idea what it's for", function () {
                expect(scope.watches['path'].weirdBoolean).toEqual(true);
            });

            it('watch installs image source', function () {
                triggerWatch();
                expect(scope.imageSource).toMatch(/base\/path/);
            });

            it('the image source is not cached by default by adding a random query string', function () {
                triggerWatch();
                expect(scope.imageSource).toMatch(/.*\?\d+/);
            });

            it('configure to use the browsers standard image cache mechanism', function () {
                config.image = {cache: true};
                triggerWatch();
                expect(scope.imageSource).toMatch(/.*(?!\?.*)/);
            });
        });

        describe('with img-class attribute watcher', function() {
            function triggerWatch() {
                scope.watches['imageClass'].callback();
            }

            describe('and no class attribute', function() {
                beforeEach(function() {
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

            describe('and class attribute', function() {
                beforeEach(function() {
                    attrs.class="legacy-class";
                    link();
                    scope.imageClass = 'img-class';
                });

                it('watch appends image class', function () {
                    triggerWatch();
                    expect(scope.imgClass).toEqual('legacy-class img-class');
                });
            });
        });
    });

    describe('ImageController', function () {
        var awsPath = 'path';
        var path = 'path';

        beforeEach(inject(function ($rootScope, $controller, cacheControl) {
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
            ctrl = $controller(ImageController, {
                $scope: scope,
                config: {awsPath: awsPath},
                uploader: uploader,
                $templateCache: {removeAll: function () {
                    cacheControl.cleared = true;
                }}
            })
        }));

        it('init', function () {
            expect(scope.imageSource).toEqual(awsPath);
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

        it('add a file to the uploader', function () {
            ctrl.add(file, path);

            expect(scope.name).toEqual(_file.name);
            expect(scope.canUpload).toEqual(true);
            expect(uploader.file).toEqual(_file);
            expect(uploader.path).toEqual(path);
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

        describe('on upload success', function () {
            beforeEach(function () {
                ctrl.add(file, path);
                scope.upload();
                uploader.handlers.success('payload', 201);
            });

            it('refresh image source', function () {
                expect(scope.name).toEqual('');
                expect(scope.imageSource).toContain(awsPath + uploader.path + "?");
                expect(scope.error).toEqual({});
                expect(scope.status).toEqual(201)
            });

        });

        it('upload with error', function () {
            ctrl.add(file, path);

            scope.upload();
            uploader.handlers.error('body', 500);

            expect(scope.loading).toBeFalsy();
            expect(scope.error).toEqual('Error communicating with filestore');
            expect(scope.status).toEqual(500)
        });

        it('upload with rejected', function () {
            ctrl.add(file, path);

            scope.upload();
            uploader.handlers.rejected({"contentType": ['whitelist']});

            expect(scope.loading).toBeFalsy();
            expect(scope.hasError).toEqual(true);
            expect(scope.error).toEqual({"contentType": ['whitelist']})
        });

        it('reset violations on submit', function () {
            scope.hasError = true;
            scope.upload();
            expect(scope.hasError).toEqual(false);
        });

        it('tranform violations into easy to render format', function () {
            scope.upload();
            uploader.handlers.rejected({"contentType": ['violation1', 'violation2']});

            expect(scope.violationList).toEqual([
                {'key': 'contentType', 'violation': 'violation1'},
                {'key': 'contentType', 'violation': 'violation2'}
            ])
        })
    })
});