angular.module('image.in.memory', [])
    .factory('uploader', InMemoryImageUploaderFactory);

function InMemoryImageUploaderFactory() {
    return new function() {
        this.add = function(file, path) {
            this.path = path
        };

        this.upload = function(handlers) {
            handlers.success();
        };
    };
}