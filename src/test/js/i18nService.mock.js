angular.module('i18n.mock', [])
    .service('i18n', ['$q', function ($q) {
        this.resolveDeferred = $q.defer();
        this.resolve = jasmine.createSpy('resolve').and.returnValue(this.resolveDeferred.promise);

        this.translateDeferred = $q.defer();
        this.translate = jasmine.createSpy('translate').and.returnValue(this.translateDeferred.promise);
    }])
