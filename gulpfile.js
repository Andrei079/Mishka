var gulp           = require('gulp'),
		gutil          = require('gulp-util' ),
		sass           = require('gulp-sass'),
		browserSync    = require('browser-sync'),
		concat         = require('gulp-concat'),
		uglify         = require('gulp-uglify'),
		cleanCSS       = require('gulp-clean-css'),
		rename         = require('gulp-rename'),
		del            = require('del'),
		imagemin       = require('gulp-imagemin'),
		cache          = require('gulp-cache'),
		autoprefixer   = require('gulp-autoprefixer'),
		ftp            = require('vinyl-ftp'),
		notify         = require("gulp-notify"),
		rsync          = require('gulp-rsync'),
        imageminJpegRecompress = require('imagemin-jpeg-recompress'),
        pngquant = require('imagemin-pngquant'),

// создание спрайт
      svgSprite = require('gulp-svg-sprite'),
      svgmin = require('gulp-svgmin'),
      cheerio = require('gulp-cheerio'),
	  replace = require('gulp-replace'),
	  spritesmith = require('gulp.spritesmith');
 

/*********************************
		Sprite generate  tasks  PNG
*********************************/

gulp.task('SprBuild', function () {
	var spriteData =
		gulp.src('src/img/i/*.*') // путь, откуда берем картинки для спрайта
			.pipe(spritesmith({
				imgName: '../img/sprite.png',
				cssName: '_sprite.scss',
				cssFormat: 'scss',
				algorithm: 'binary-tree',
				padding: 1,
				cssTemplate: 'scss.template.mustache',
				cssVarMap: function (sprite) {
					sprite.name = 's-' + sprite.name
				}//
			}));

	spriteData.img.pipe(gulp.dest('src/img/')); // путь, куда сохраняем картинку
	spriteData.css.pipe(gulp.dest('src/scss/')); // путь, куда сохраняем стили
});


/*********************************
		Sprite generate  tasks  SVG
*********************************/
/// из src/img/i   в   src/img/
//спрайты css  _sprite.scss в папку scss  не включается в main scss
// или  symbol  _sprite.scss в папку scss  sprite копируется в html см. синтаксис
var config = {
  mode: {
    css: {
      sprite: "../../img/sprite.svg",
      render: {
        scss: {
          dest: '../../scss/_sprite.scss'
        }
      }
    }
  }
};

gulp.task('svgSprBuild', function() {
  return gulp.src('src/img/i/*.svg')
    // минифицируем svg
    .pipe(svgmin({
      js2svg: {
        pretty: true
      }
    }))
    // удалить все атрибуты fill, style and stroke в фигурах
    .pipe(cheerio({
      run: function($) {
        $('[fill]').removeAttr('fill');
        $('[stroke]').removeAttr('stroke');
        $('[style]').removeAttr('style');
      },
      parserOptions: { xmlMode: true }
    }))
    // cheerio плагин заменит, если появилась, скобка '&gt;', на нормальную.
    .pipe(replace('&gt;', '>'))
    // build svg sprite
		.pipe(svgSprite(config))
		.pipe(notify('Спрайт успешно создан!'))
		.pipe(gulp.dest('src/img/'));
				
		
});

// Более наглядный вывод ошибок
var log = function(error) {
  console.log([
    '',
    "----------ERROR MESSAGE START----------",
    ("[" + error.name + " in " + error.plugin + "]"),
    error.message,
    "----------ERROR MESSAGE END----------",
    ''
  ].join('\n'));
  this.end();
}







/*********************************
		Developer tasks
*********************************/


// SCSS в CSS compile
	gulp.task('sass', function() {
		return gulp.src('src/scss/**/*.scss')
		.pipe(sass({outputStyle: 'expand'}).on("error", notify.onError()))
		.pipe(rename({suffix: '.min', prefix : ''}))
		.pipe(autoprefixer(['last 15 versions']))
		.pipe(cleanCSS()) // Опционально, закомментировать при отладке
		.pipe(gulp.dest('src/css'))
		.pipe(browserSync.reload({stream: true}))
    .pipe(notify('ПРЕОБРАЗОВАН в CSS!!!.'));
	});


// JS compile
// Пользовательские скрипты 
	gulp.task('common-js', function() {
		return gulp.src([
			'src/js/common.js',
			])
		.pipe(concat('common.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest('src/js'));
	});
// добавление  script lib
	gulp.task('js', ['common-js'], function() {
		return gulp.src([
			'src/libs/jquery/build/jquery.min.js',
			'src/js/common.min.js', // Всегда в конце
			])
		.pipe(concat('scripts.min.js'))
	   .pipe(uglify()) // Минимизировать весь js на продакшен (на выбор)
		.pipe(gulp.dest('src/js'))
		.pipe(browserSync.reload({stream: true}));
	});

//server
	gulp.task('browser-sync', function() {
		browserSync({
			server: {
				baseDir: 'src'
			},
			notify: true,
			// tunnel: true,
			// tunnel: "projectmane", //Demonstration page: http://projectmane.localtunnel.me
		});
	});

// WATCH
	gulp.task('watch', ['sass', 'js', 'browser-sync'], function() {
		gulp.watch('src/scss/**/*.scss', ['sass']);
		gulp.watch(['libs/**/*.js', 'src/js/common.js'], ['js']);
		gulp.watch('src/*.html', browserSync.reload);
	    
	});



/*********************************
		Production tasks
*********************************/

// МИНИМИЗАЦИЯ ИЗОБРАЖЕНИЙ папку i  переносить не надо
// Images optimization and copy in /dist
gulp.task('imagemin', function () {
	return gulp.src(['!src/img/i/*', 'src/img/**/*'])
		.pipe(cache(imagemin([
			imagemin.gifsicle({ interlaced: true }),
			imagemin.jpegtran({ progressive: true }),
			imageminJpegRecompress({
				loops: 5,
				min: 65,
				max: 70,
				quality: 'medium'
			}),
			imagemin.svgo(),
			imagemin.optipng({ optimizationLevel: 3 }),
			pngquant({ quality: '65-70', speed: 5 })
		], {
				verbose: true
			})))		
		.pipe(gulp.dest('build/img')) 
});


//BUILD
gulp.task('build', ['removebuild', 'imagemin', 'sass', 'js'], function() {

	//html переносит
		var buildFiles = gulp.src([
			'src/*.html',
			'src/.htaccess',
			]).pipe(gulp.dest('build'));
	//css переносит
		var buildCss = gulp.src([
			'src/css/main.min.css',
			]).pipe(gulp.dest('build/css'));
	//js  переносит
		var buildJs = gulp.src([
			'src/js/scripts.min.js',
			]).pipe(gulp.dest('build/js'));
	//fonts  переносит
		var buildFonts = gulp.src([
			'src/fonts/**/*',
			]).pipe(gulp.dest('build/fonts'))
			.pipe(notify('Сборка завершена!.'));	    
	 

});




/*********************************
		  FTP
*********************************/


gulp.task('deploy', function() {

	var conn = ftp.create({
		// имя хоста предоставляется хостингом
		host:      '',
		// им я пользователя
		user:      '',
		password:  '',
		parallel:  10,
		log: gutil.log
	});

	var globs = [
	'build/**',
	'build/.htaccess',
	];
	return gulp.src(globs, {buffer: false})
	// путь на сервере
/* 	.pipe(conn.dest('/path/to/folder/on/server'));  образец */
		.pipe(conn.dest(''));
	
	

});



gulp.task('rsync', function() {
	return gulp.src('build/**')
	.pipe(rsync({
		root: 'build/',
		hostname: 'username@yousite.com',
		destination: 'yousite/public_html/', // пароль при входе в терминале или нужен ssh-ключ
		// include: ['*.htaccess'], // Скрытые файлы, которые необходимо включить в деплой
		recursive: true,
		archive: true,
		silent: false,
		compress: true
	}));
});



gulp.task('removebuild', function() { return del.sync('build'); });
gulp.task('clearcache', function () { return cache.clearAll(); });
gulp.task('default', ['watch']);
