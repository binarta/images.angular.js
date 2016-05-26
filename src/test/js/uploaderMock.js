angular.module('uploader.mock', [])
    .service('uploader', function () {
        var self = this;
        this.spy = {};

        this.add = function (file, path, type, carouselImage) {
            self.spy.add = {
                file: file,
                path: path,
                imageType: type,
                carouselImage: carouselImage
            }
        };

        this.upload = function (handlers) {
            self.spy.upload = handlers
        };
    });

