basePath = '../';

files = [
    JASMINE,
    JASMINE_ADAPTER,
    'bower_components/angular/angular.js',
    'bower_components/angular-mocks/angular-mocks.js',
    'bower_components/thk-cache-control-mock/src/cache.control.mock.js',
    'bower_components/thk-notifications-mock/src/notifications.mock.js',
    'bower_components/thk-config-mock/src/config.mock.js',
    'src/main/js/**/*.js',
    'src/test/js/**/*.js'
];

autoWatch = true;

browsers = ['PhantomJS'];

junitReporter = {
    outputFile: 'test_out/unit.xml',
    suite: 'unit'
};
