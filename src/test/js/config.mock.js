angular.module('config', [])
    .value('config', {})
    .factory('configWriter', ['$q', function ($q) {
        configWriterDeferred = $q.defer();
        return jasmine.createSpy('configWriter').and.returnValue(configWriterDeferred.promise);
    }]);
