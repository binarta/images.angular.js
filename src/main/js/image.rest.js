(function () {
    angular.module('image.rest', ['config', 'rest.client'])
        .factory('uploader', ['restServiceHandler', 'config', ImageUploaderFactory]);

    function ImageUploaderFactory(rest, config) {
        return new function () {
            var self = this;

            this.add = function (file, path, imageType, carouselImage) {
                self.file = file.files[0];
                self.path = path;
                self.imageType = imageType;
                self.carouselImage = carouselImage;
            };

            this.upload = function (handlers) {
                var ctx = {
                    params: {
                        method: 'PUT',
                        url: (config.baseUri || '') + "api/image/" + (self.path != null ? self.path : ""),
                        params: {
                            namespace:config.namespace,
                            imageType: self.imageType
                        },
                        data: self.file,
                        headers: {
                            'Content-Type': self.file ? self.file.type : null,
                            'Content-Length': self.file ? self.file.size : 0
                        },
                        withCredentials:true
                    }
                };
                if (self.carouselImage) ctx.params.headers['X-Binarta-Carousel'] = true;

                if (handlers) {
                    ['success', 'error', 'rejected'].forEach(function (it) {
                        if (handlers[it]) ctx[it] = handlers[it];
                    });
                }
                return rest(ctx);
            };
        };
    }
})();