angular.module('permissions', [])
    .factory('activeUserHasPermission', function(activeUserHasPermissionHelper) {
        return function(response, permission){
            activeUserHasPermissionHelper.yes = response.yes;
            activeUserHasPermissionHelper.no = response.no;
            activeUserHasPermissionHelper.permission = permission;
        };
    })
    .factory('activeUserHasPermissionHelper', function() {
        return {};
    });