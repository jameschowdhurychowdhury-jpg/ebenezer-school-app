'use strict';
/**
 * Entry point – starts the main school site and the separate Admin Panel.
 *   npm start      -> http://localhost:3000  (school app)   +   http://localhost:4000  (admin panel)
 */
const fs = require('fs');
const config = require('./config');
const { createMainApp } = require('./main-server');
const { createAdminApp } = require('./admin-server');

// make sure every storage / database folder exists
const p = config.paths;
[
  p.students,
  require('path').dirname(p.teachers),
  require('path').dirname(p.staff),
  require('path').dirname(p.admin),
  p.studentPhotos,
  p.teacherPhotos,
  p.logo,
  p.icons,
  ...config.CLASSES.map((c) => require('path').join(p.studentPhotos, c)),
].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

createMainApp().listen(config.PORT, () => {
  console.log(`✔ School app      → http://localhost:${config.PORT}`);
});
createAdminApp().listen(config.ADMIN_PORT, () => {
  console.log(`✔ Admin panel     → http://localhost:${config.ADMIN_PORT}`);
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.message));
