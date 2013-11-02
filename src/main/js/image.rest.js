angular.module('image.rest', [])
    .factory('uploader', ['restServiceHandler', 'config', ImageUploaderFactory])

function ImageUploaderFactory(restServiceHandler, config) {
    return new function () {
        this.add = function (file, path) {
            this.file = file.files[0];
            this.path = path;
        };

        this.upload = function (handlers) {
            var ctx = {params: {
                method: 'PUT',
                url: (config.baseUri || '') + "api/image/" + (this.path != null ? this.path : "") + "?namespace=" + config.namespace,
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