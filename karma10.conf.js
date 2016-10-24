module.exports = function(config) {
    config.set({
        basePath:'.',
        frameworks:['jasmine'],
        files:[
            {pattern:'bower_components/angular/angular.js'},
            {pattern:'bower_components/angular-route/angular-route.js'},
            {pattern:'bower_components/angular-mocks/angular-mocks.js'},
            {pattern:'bower_components/thk-cache-control-mock/src/cache.control.mock.js'},
            {pattern:'bower_components/thk-notifications-mock/src/notifications.mock.js'},
            {pattern:'bower_components/thk-config-mock/src/config.mock.js'},
            {pattern:'bower_components/thinkerit.angularx.bootstrap.mocks/src/angularx.bootstrap.mocks.js'},
            {pattern:'bower_components/binarta.toggle.edit.mode.angular/src/main/js/toggle.edit.mode.js'},
            {pattern:'bower_components/binartajs/src/binarta.js'},
            {pattern:'bower_components/binartajs/src/checkpoint.js'},
            {pattern:'bower_components/binartajs/src/gateways.inmem.js'},
            {pattern:'bower_components/binartajs-angular1/src/binarta-angular.js'},
            {pattern:'bower_components/binartajs-angular1/src/binarta-checkpoint-angular.js'},
            {pattern:'bower_components/binartajs-angular1/src/binarta-checkpoint-inmem-angular.js'},
            {pattern: 'bower_components/binarta.web.storage.angular/src/web.storage.js'},
            {pattern:'src/main/js/image.in.memory.js'},
            {pattern:'src/main/js/image.rest.js'},
            {pattern:'src/main/js/images.js'},
            {pattern:'src/test/js/**/*.js'}
        ],
        browsers:['PhantomJS']
    });
};
