angular.module('config', [])
    .value('config', {})
    .factory('configWriter', function () {
        return jasmine.createSpy('configWriter');
    });
