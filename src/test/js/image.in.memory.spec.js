describe('image.in.memory', function() {
    var $httpBackend;
    var _uploader;
    var file, path;
    var success;

    beforeEach(module('image.in.memory'));
    beforeEach(inject(function ($injector) {
        $httpBackend = $injector.get('$httpBackend');
        _uploader = InMemoryImageUploaderFactory();
        file = {};
        path = 'path';
    }));
    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('add a file adds the path', function() {
        _uploader.add(file, path);

        expect(_uploader.path).toEqual(path);
    });

    it('upload function does nothing', function() {
        _uploader.add(file, path);
        _uploader.upload({success: function() {success = true;}});

        expect(success).toBeTruthy();
    });

});