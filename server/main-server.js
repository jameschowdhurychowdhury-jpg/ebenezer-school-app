'use strict';
/**
 * MAIN SCHOOL SITE  (Students, Teachers, Class Teachers, Principal, Administrative)
 */
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { SessionStore, Lockout } = require('./lib/security');
const mw = require('./lib/middleware');

const { paths, ROLES } = config;

function createMainApp() {
  const app = express();
  const sessions = new SessionStore({
    cookieName: 'ehs_sid',
    idleMs: config.SESSION.IDLE_MS,
    maxMs: config.SESSION.MAX_MS,
  });
  const lockout = new Lockout({ maxFails: config.LOGIN.MAX_FAILS, lockMs: config.LOGIN.LOCK_MS });

  app.disable('x-powered-by');
  app.set('trust proxy', config.IS_PROD ? 1 : false);
  app.use(mw.securityHeaders());
  app.use(cookieParser());
  app.use(express.json({ limit: '512kb' }));
  app.use(mw.loadSession(sessions));

  /* ---------- public static assets (css / js / fonts / images) ---------- */
  app.use(
    '/assets',
    express.static(path.join(paths.publicDir, 'assets'), { dotfiles: 'deny', index: false, maxAge: '1h' }),
  );

  /* ---------- API ---------- */
  const api = express.Router();
  api.use(mw.noStore, mw.sameOriginOnly, mw.jsonOnly);
  api.use('/auth', require('./routes/auth')({ sessions, lockout }));
  api.use('/profile', require('./routes/profile')({ sessions }));
  api.use('/features', require('./routes/features')());
  api.use('/notices', require('./routes/notices')());
  api.use('/chat', require('./routes/chat')());
  api.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
  app.use('/api', api);

  app.use('/media', require('./routes/media')());

  /* ---------- Login & Logout screen ---------- */
  app.get('/', mw.noStore, (req, res) => {
    if (req.session) return res.redirect(302, ROLES[req.session.user.role].home);
    return res.sendFile(path.join(paths.publicDir, 'index.html'));
  });

  app.all('/logout', mw.noStore, (req, res) => {
    sessions.destroy(req, res);
    res.set('Clear-Site-Data', '"cache"');
    return res.redirect(302, '/');
  });

  /* ---------- Legal pages (public, also linked from every dashboard menu) ---------- */
  app.get('/legal/privacy', (_req, res) => res.sendFile(path.join(paths.publicDir, 'legal', 'privacy.html')));
  app.get('/legal/terms', (_req, res) => res.sendFile(path.join(paths.publicDir, 'legal', 'terms.html')));

  /* ---------- Protected dashboards – each role can open ONLY its own folder ---------- */
  const dashboards = {
    student: 'student',
    teacher: 'teacher',
    classteacher: 'class-teacher',
    principal: 'principal',
    administrative: 'administrative',
  };
  for (const [role, folder] of Object.entries(dashboards)) {
    app.use(
      `/${folder}`,
      mw.requirePageRole([role]),
      express.static(path.join(paths.appDir, folder), { dotfiles: 'deny', extensions: ['html'] }),
    );
  }
  // assets shared by all dashboards (only for logged-in users)
  app.use(
    '/app-shared',
    mw.requirePageRole('*'),
    mw.noStore,
    express.static(path.join(paths.appDir, 'shared'), { dotfiles: 'deny', index: false }),
  );

  /* ---------- 404 + error handler (never leaks stack traces) ---------- */
  app.use((_req, res) => res.status(404).sendFile(path.join(paths.publicDir, '404.html')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[main] error:', err && err.message);
    if (res.headersSent) return;
    res.status(err.status && err.status < 500 ? err.status : 500).json({ ok: false, error: 'Something went wrong.' });
  });

  return app;
}

module.exports = { createMainApp };
