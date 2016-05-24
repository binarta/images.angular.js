angular.module('rest.client', [])
    .factory('restServiceHandler', function () {
        return jasmine.createSpy('restServiceHandler');
    });