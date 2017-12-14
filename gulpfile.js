/* eslint-env node */

const gulp = require('gulp');
const concat = require('gulp-concat');

gulp.task('build-core', () =>
    gulp.src(
        [
            'node_modules/@babel/standalone/babel.min.js',
            './lib/core.js',
            './lib/plugins/*.js',
        ]
    )
        .pipe(concat('unchained.core.js'))
        .pipe(gulp.dest('./dist/'))
);

gulp.task('build-sw', () =>
    gulp.src(
        [
            'node_modules/@babel/standalone/babel.min.js',
            './lib/core.js',
            './lib/plugins/*.js',
            './lib/sw.js',
        ]
    )
        .pipe(concat('unchained.sw.js'))
        .pipe(gulp.dest('./dist/'))
);

gulp.task('build-client', () =>
    gulp.src(
        [
            './lib/client.js',
        ]
    )
        .pipe(concat('unchained.client.js'))
        .pipe(gulp.dest('./dist/'))
);

gulp.task('build', ['build-core', 'build-sw', 'build-client']);
