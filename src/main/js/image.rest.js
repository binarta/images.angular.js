angular.module('image.rest', ['config', 'rest.client'])
    .factory('uploader', ['restServiceHandler', 'config', ImageUploaderFactory]);

function ImageUploaderFactory(restServiceHandler, config) {
    return new function () {
        this.add = function (file, path, imageType) {
            this.file = file.files[0];
            this.path = path;
            this.imageType = imageType;
        };

        this.upload = function (handlers) {
            var ctx = {params: {
                method: 'PUT',
                url: (config.baseUri || '') + "api/image/" + (this.path != null ? this.path : ""),
                params: {
                    namespace:config.namespace,
                    imageType:this.imageType
                },
                data: this.file,
                headers: {
                    'Content-Type': this.file ? this.file.type : null, 'Content-Length': this.file ? this.file.size : 0
                },
                withCredentials:true
            }};
            if (handlers) {
                ['success', 'error', 'rejected'].forEach(function (it) {
                    if (handlers[it]) ctx[it] = handlers[it];
                });
            }
            return restServiceHandler(ctx);
        };
    };
}