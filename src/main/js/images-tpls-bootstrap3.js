angular.module("image-management.templates", []).run(["$templateCache", function($templateCache) {$templateCache.put("bin-icon-edit.html","<form ng-submit=\"submit()\" class=\"ng-pristine ng-valid ng-scope\"><div class=\"bin-menu-edit-body\" ng-switch=\"state.name\"><div ng-switch-when=\"image\"><div class=\"bin-image-preview\"><div class=\"row\"><div class=\"col-xs-12 col-md-4 col-lg-4\"><img ng-src=\"{{state.imageSrc}}\" read-only=\"\" ng-click=\"upload()\"></div><div class=\"col-xs-12 col-md-8 col-lg-8\"><p><button type=\"button\" class=\"btn btn-success\" ng-click=\"upload()\" i18n=\"\" code=\"bin.icon.new.image\" read-only=\"\"><i class=\"fa fa-upload fa-fw\"></i> <span ng-bind=\"::var\"></span></button></p><p i18n=\"\" code=\"upload.image.advice\" read-only=\"\"><i class=\"fa fa-fw fa-info-circle\"></i> <span ng-bind=\"::var\"></span></p><bin-violations class=\"bin-icon-violations\" src=\"state.violations\" fade-after=\"7000\" code-prefix=\"upload.image\"></bin-violations><p ng-if=\"state.uploading\" i18n=\"\" code=\"upload.image.uploading\" read-only=\"\"><i class=\"fa fa-spinner fa-spin fa-fw\"></i> <span ng-bind=\"::var\"></span></p></div></div></div></div><div ng-switch-default=\"\"><bin-violations class=\"bin-icon-violations\" src=\"state.violations\" fade-after=\"7000\" code-prefix=\"bin.icon\"></bin-violations><div class=\"icons-list\"><button type=\"submit\" ng-click=\"state.icon=\'fa-\' + i\" title=\"{{::i}}\" ng-class=\"{\'active\':state.icon == \'fa-\' + i}\" ng-repeat=\"i in [\'\', \'adjust\', \'anchor\', \'archive\', \'area-chart\', \'arrows\', \'arrows-h\', \'arrows-v\', \'asterisk\', \'at\', \'ban\', \'bar-chart\', \'barcode\', \'bars\', \'beer\', \'bell\', \'bell-o\', \'bell-slash\', \'bell-slash-o\', \'bicycle\', \'binoculars\', \'birthday-cake\', \'bolt\', \'bomb\', \'book\', \'bookmark\', \'bookmark-o\', \'briefcase\', \'bug\', \'building\', \'building-o\', \'bullhorn\', \'bullseye\', \'bus\', \'calculator\', \'calendar\', \'calendar-o\', \'camera\', \'camera-retro\', \'car\', \'caret-square-o-down\', \'caret-square-o-left\', \'caret-square-o-right\', \'caret-square-o-up\', \'cc\', \'certificate\', \'check\', \'check-circle\', \'check-circle-o\', \'check-square\', \'check-square-o\', \'child\', \'circle\', \'circle-o\', \'circle-o-notch\', \'circle-thin\', \'clock-o\', \'cloud\', \'cloud-download\', \'cloud-upload\', \'code\', \'code-fork\', \'coffee\', \'cog\', \'cogs\', \'comment\', \'comment-o\', \'comments\', \'comments-o\', \'compass\', \'copyright\', \'credit-card\', \'crop\', \'crosshairs\', \'cube\', \'cubes\', \'cutlery\', \'database\', \'desktop\', \'dot-circle-o\', \'download\', \'ellipsis-h\', \'ellipsis-v\', \'envelope\', \'envelope-o\', \'envelope-square\', \'eraser\', \'exchange\', \'exclamation\', \'exclamation-circle\', \'exclamation-triangle\', \'external-link\', \'external-link-square\', \'eye\', \'eye-slash\', \'eyedropper\', \'fax\', \'female\', \'fighter-jet\', \'file\', \'file-o\', \'file-text\', \'file-text-o\', \'file-archive-o\', \'file-audio-o\', \'file-code-o\', \'file-excel-o\', \'file-image-o\', \'file-pdf-o\', \'file-powerpoint-o\', \'file-video-o\', \'file-word-o\', \'film\', \'filter\', \'fire\', \'fire-extinguisher\', \'flag\', \'flag-checkered\', \'flag-o\', \'flask\', \'folder\', \'folder-o\', \'folder-open\', \'folder-open-o\', \'frown-o\', \'futbol-o\', \'gamepad\', \'gavel\', \'gift\', \'glass\', \'globe\', \'graduation-cap\', \'hdd-o\', \'headphones\', \'heart\', \'heart-o\', \'history\', \'home\', \'inbox\', \'info\', \'info-circle\', \'key\', \'keyboard-o\', \'language\', \'laptop\', \'leaf\', \'lemon-o\', \'level-down\', \'level-up\', \'life-ring\', \'lightbulb-o\', \'line-chart\', \'location-arrow\', \'lock\', \'magic\', \'magnet\', \'male\', \'map-marker\', \'meh-o\', \'microphone\', \'microphone-slash\', \'minus\', \'minus-circle\', \'minus-square\', \'minus-square-o\', \'mobile\', \'money\', \'moon-o\', \'music\', \'newspaper-o\', \'paint-brush\', \'paper-plane\', \'paper-plane-o\', \'paw\', \'pencil\', \'pencil-square\', \'pencil-square-o\', \'phone\', \'phone-square\', \'picture-o\', \'pie-chart\', \'plane\', \'plug\', \'plus\', \'plus-circle\', \'plus-square\', \'plus-square-o\', \'power-off\', \'print\', \'puzzle-piece\', \'qrcode\', \'question\', \'question-circle\', \'quote-left\', \'quote-right\', \'random\', \'recycle\', \'refresh\', \'reply\', \'reply-all\', \'retweet\', \'road\', \'rocket\', \'rss\', \'rss-square\', \'search\', \'search-minus\', \'search-plus\', \'share\', \'share-alt\', \'share-alt-square\', \'share-square\', \'share-square-o\', \'shield\', \'shopping-cart\', \'sign-in\', \'sign-out\', \'signal\', \'sitemap\', \'sliders\', \'smile-o\', \'sort\', \'sort-alpha-asc\', \'sort-alpha-desc\', \'sort-amount-asc\', \'sort-amount-desc\', \'sort-asc\', \'sort-desc\', \'sort-numeric-asc\', \'sort-numeric-desc\', \'space-shuttle\', \'spinner\', \'spoon\', \'square\', \'square-o\', \'star\', \'star-half\', \'star-half-o\', \'star-o\', \'suitcase\', \'sun-o\', \'tablet\', \'tachometer\', \'tag\', \'tags\', \'tasks\', \'taxi\', \'terminal\', \'thumb-tack\', \'thumbs-down\', \'thumbs-o-down\', \'thumbs-o-up\', \'thumbs-up\', \'ticket\', \'times\', \'times-circle\', \'times-circle-o\', \'tint\', \'toggle-off\', \'toggle-on\', \'trash\', \'trash-o\', \'tree\', \'trophy\', \'truck\', \'tty\', \'umbrella\', \'university\', \'unlock\', \'unlock-alt\', \'upload\', \'user\', \'users\', \'video-camera\', \'volume-down\', \'volume-off\', \'volume-up\', \'wheelchair\', \'wifi\', \'wrench\']\"><i class=\"fa fa-fw\" ng-class=\"::i ? \'fa-\' + i: \'\'\"></i></button></div></div></div><div class=\"bin-menu-edit-actions\"><button ng-if=\"state.name == \'image\'\" class=\"btn btn-default pull-left\" ng-click=\"changeView()\" i18n=\"\" code=\"bin.icon.back.icons\" read-only=\"\" ng-bind=\"var\"></button> <button ng-if=\"state.name != \'image\' && state.isUploadPermitted\" class=\"btn btn-default pull-left\" ng-click=\"changeView()\" i18n=\"\" code=\"bin.icon.upload.image\" read-only=\"\" ng-bind=\"var\"></button> <button ng-if=\"state.name == \'image\'\" type=\"submit\" class=\"btn btn-primary\" i18n=\"\" code=\"bin.icon.ok\" read-only=\"\" ng-bind=\"var\"></button> <button type=\"reset\" class=\"btn btn-default\" ng-click=\"cancel()\" i18n=\"\" code=\"i18n.menu.cancel.button\" read-only=\"\" ng-bind=\"var\"></button></div></form>");
$templateCache.put("bin-icon.html","<a ng-href=\"{{$ctrl.link}}\" target=\"{{$ctrl.linkTarget}}\" ng-if=\"$ctrl.link\"><img ng-if=\"$ctrl.iconValue == \'image\'\" class=\"bin-icon\" ng-src=\"{{$ctrl.imageSrc}}\"> <i ng-if=\"$ctrl.iconValue != \'image\'\" class=\"bin-icon fa fa-fw\" ng-class=\"$ctrl.iconValue\"></i></a> <span ng-if=\"!$ctrl.link\"><img ng-if=\"$ctrl.iconValue == \'image\'\" class=\"bin-icon\" ng-src=\"{{$ctrl.imageSrc}}\"> <i ng-if=\"$ctrl.iconValue != \'image\'\" class=\"bin-icon fa fa-fw\" ng-class=\"$ctrl.iconValue\"></i></span>");}]);