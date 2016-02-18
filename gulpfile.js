var gulp = require('gulp'),
    minifyHtml = require('gulp-minify-html'),
    template = require('gulp-template'),
    templateCache = require('gulp-angular-templatecache');

var minifyHtmlOpts = {
    empty: true,
    cdata: true,
    conditionals: true,
    spare: true,
    quotes: true
};

gulp.task('images-clerk-bootstrap3', function () {
    gulp.src('template/clerk/bootstrap3/*.html')
        .pipe(template())
        .pipe(minifyHtml(minifyHtmlOpts))
        .pipe(templateCache('images-clerk-tpls-bootstrap3.js', {standalone: false, module: 'image-management'}))
        .pipe(gulp.dest('src/main/js'));
});

gulp.task('default', ['images-clerk-bootstrap3']);