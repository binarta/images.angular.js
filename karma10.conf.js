module.exports = function(config) {
    config.set({
        basePath:'.',
        frameworks:['jasmine'],
        files:[
            {pattern:'bower_components/angular/angular.js'},
            {pattern:'bower_components/angular-mocks/angular-mocks.js'},
            {pattern:'bower_components/thk-cache-control-mock/src/cache.control.mock.js'},
            {pattern:'bower_components/thk-notifications-mock/src/notifications.mock.js'},
            {pattern:'bower_components/thinkerit.angularx.bootstrap.mocks/src/angularx.bootstrap.mocks.js'},
            {pattern:'src/main/js/**/*.js'},
            {pattern:'src/test/js/**/*.js'}
        ],
        browsers:['PhantomJS']
    });
};