angular.module('rest.client', []);

describe('image.rest', function () {
    var scope, rest, notifications;
    var $httpBackend;
    var uploader;
    var _file = {
        size: 1,
        type: 'type',
        name: 'name'
    };
    var file = {
        files: [_file]
    };

    beforeEach(module('image.rest'));
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

    describe('rest uploader', function () {
        var namespace = 'namespace';
        var config;

        beforeEach(inject(function () {
            config = {namespace: namespace};
            uploader = ImageUploaderFactory(rest.service, config);
        }));

        it('add a file', function () {
            uploader.add(file, 'path');

            expect(uploader.file).toEqual(_file);
            expect(uploader.path).toEqual('path');
        });

        it('upload a file', function () {
            uploader.add(file, 'path');

            uploader.upload();
            expect(rest.ctx.params.method).toEqual('PUT');
            expect(rest.ctx.params.url).toEqual('api/image/path?namespace=' + namespace);
            expect(rest.ctx.params.data).toEqual(_file);
            expect(rest.ctx.params.headers['Content-Type']).toEqual(_file.type);
            expect(rest.ctx.params.headers['Content-Length']).toEqual(_file.size);
        });

        it('upload with baseUri', function () {
            config.baseUri = 'http://host/context/';
            uploader.add(file, 'path');
            uploader.upload();
            expect(rest.ctx.params.url).toEqual(config.baseUri + 'api/image/path?namespace=' + namespace);
        });

        it('check headers', function () {
            uploader.upload();
            expect(rest.ctx.params.method).toEqual('PUT');
            expect(rest.ctx.params.url).toEqual('api/image/?namespace=' + namespace);
            expect(rest.ctx.params.data).toEqual(null);
            expect(rest.ctx.params.headers['Content-Type']).toEqual(null);
            expect(rest.ctx.params.headers['Content-Length']).toEqual(0);
        });

        ['success', 'error', 'rejected'].forEach(function (handler) {
            it('result handlers can be registered', function () {
                var handlers = {};
                handlers[handler] = handler;
                uploader.upload(handlers);
                expect(rest.ctx[handler]).toEqual(handler);
            });
        });
    })
});