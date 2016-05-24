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

        beforeEach(inject(function (_uploader_, _config_, restServiceHandler) {
            config = _config_;
            config.namespace = namespace;
            uploader = _uploader_;
            rest = restServiceHandler;
        }));

        it('add a file', function () {
            uploader.add(file, 'path', 'type');

            expect(uploader.file).toEqual(_file);
            expect(uploader.path).toEqual('path');
            expect(uploader.imageType).toEqual('type');
        });

        it('upload a file', function () {
            uploader.add(file, 'path', 'type');

            uploader.upload();

            expect(rest.calls[0].args[0].params.method).toEqual('PUT');
            expect(rest.calls[0].args[0].params.url).toEqual('api/image/path');
            expect(rest.calls[0].args[0].params.params).toEqual({
                namespace:namespace,
                imageType:'type'
            });
            expect(rest.calls[0].args[0].params.data).toEqual(_file);
            expect(rest.calls[0].args[0].params.headers['Content-Type']).toEqual(_file.type);
            expect(rest.calls[0].args[0].params.headers['Content-Length']).toEqual(_file.size);
        });

        it('upload with baseUri', function () {
            config.baseUri = 'http://host/context/';
            uploader.add(file, 'path');
            uploader.upload();
            expect(rest.calls[0].args[0].params.url).toEqual(config.baseUri + 'api/image/path');
        });

        it('check headers', function () {
            uploader.upload();
            expect(rest.calls[0].args[0].params.method).toEqual('PUT');
            expect(rest.calls[0].args[0].params.url).toEqual('api/image/');
            expect(rest.calls[0].args[0].params.data).toEqual(null);
            expect(rest.calls[0].args[0].params.headers['Content-Type']).toEqual(null);
            expect(rest.calls[0].args[0].params.headers['Content-Length']).toEqual(0);
        });

        ['success', 'error', 'rejected'].forEach(function (handler) {
            it('result handlers can be registered', function () {
                var handlers = {};
                handlers[handler] = handler;
                uploader.upload(handlers);
                expect(rest.calls[0].args[0][handler]).toEqual(handler);
            });
        });
    });
});