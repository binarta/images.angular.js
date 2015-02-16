angular.module('uploader.mock', [])
    .service('uploader', function () {
        var self = this;
        this.spy = {};

        this.add = function (file, path) {
            self.spy.add = {
                file: file,
                path: path
            }
        };

        this.upload = function (handlers) {
            self.spy.upload = handlers
        };
    });

