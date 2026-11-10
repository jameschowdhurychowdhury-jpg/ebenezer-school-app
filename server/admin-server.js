'use strict';
/**
 * ADMIN PANEL – Express sub-app for the school administrative dashboard.
 */
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./lib/db');
const { SessionStore, Lockout, verifyPassword } = require('./lib/security');
const mw = require('./lib/middleware');

const { paths } = config;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ipAllowList(req, res, next) {
  if (!config.ADMIN_ALLOWED_IPS || !config.ADMIN_ALLOWED_IPS.length) return next();
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  if (config.ADMIN_ALLOWED_IPS.includes(ip)) return next();
  return res.status(404).end();
}

function createAdminApp() {
  const app = express();
  const sessions = new SessionStore({
    cookieName: 'ehs_admin_sid',
    idleMs: config.ADMIN_SESSION ? config.ADMIN_SESSION.IDLE_MS : 30 * 60 * 1000,
    maxMs: config.ADMIN_SESSION ? config.ADMIN_SESSION.MAX_MS : 8 * 60 * 60 * 1000,
  });
  const lockout = new Lockout({ maxFails: 5, lockMs: 15 * 60 * 1000 });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(ipAllowList);
  app.use(mw.securityHeaders());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(mw.loadSession(sessions));

  // Static Assets for Admin
  app.use('/assets', mw.noStore, express.static(path.join(paths.publicDir, 'assets'), { dotfiles: 'deny', index: false }));
  app.use('/admin-assets', mw.noStore, express.static(path.join(paths.adminDir, 'assets'), { dotfiles: 'deny', index: false }));
  if (paths.mediaDir) {
    app.use('/media', require('./routes/media')());
  }

  app.get('/legal/privacy', (_req, res) => res.sendFile(path.join(paths.publicDir, 'legal', 'privacy.html')));
  app.get('/legal/terms', (_req, res) => res.sendFile(path.join(paths.publicDir, 'legal', 'terms.html')));

  // Admin API Routes
  const api = express.Router();
  api.use(mw.noStore);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { ok: false, error: 'Too many attempts. Please wait 15 minutes.' },
  });

  api.post('/login', limiter, async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ ok: false, error: 'Please enter both username and password.' });
      }
      const key = username.trim().toLowerCase();
      const left = lockout.remainingMs(key);
      if (left > 0) {
        return res.status(429).json({ ok: false, error: `Locked. Try again in ${Math.ceil(left / 60000)} minute(s).` });
      }
      const a = await db.findAdminByUsername(username.trim());
      const ok = await verifyPassword(password, a ? a.Password : null);
      if (!a || !ok || !db.isActive(a)) {
        lockout.fail(key);
        await sleep(300 + Math.floor(Math.random() * 200));
        return res.status(401).json({ ok: false, error: 'Invalid admin credentials.' });
      }
      lockout.clear(key);
      sessions.create(req, res, {
        uid: 'admin',
        role: 'admin',
        id: a['Chat ID'] || 'Admin',
        name: a.Name || 'Admin',
      });
      return res.json({ ok: true, redirect: '/admin/panel/' });
    } catch (err) {
      return next(err);
    }
  });

  api.post('/logout', (req, res) => {
    sessions.destroy(req, res);
    res.json({ ok: true, redirect: '/admin/' });
  });

  api.get('/me', mw.requireApiRole(['admin']), (req, res) => {
    res.json({ ok: true, name: req.session.user.name, chatId: req.session.user.id, role: 'admin' });
  });

  // Shared Data endpoints: Notices, Chat, and DB Operations
  api.use('/notices', require('./routes/notices')());
  api.use('/chat', require('./routes/chat')());
  api.use('/admin', require('./routes/admin-api')());

  api.use((_req, res) => res.status(404).json({ ok: false, error: 'API route not found.' }));
  app.use('/api', api);

  // Admin Front-end Pages
  app.get('/', mw.noStore, (req, res) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
      return res.redirect(302, '/admin/panel/');
    }
    return res.sendFile(path.join(paths.adminDir, 'login.html'));
  });

  app.all('/logout', mw.noStore, (req, res) => {
    sessions.destroy(req, res);
    res.set('Clear-Site-Data', '"cache"');
    return res.redirect(302, '/admin/');
  });

  app.use(
    '/panel',
    mw.requirePageRole(['admin']),
    express.static(path.join(paths.adminDir, 'panel'), { dotfiles: 'deny', extensions: ['html'] }),
  );

  app.use(
    '/app-shared',
    mw.requirePageRole(['admin']),
    express.static(path.join(paths.appDir, 'shared'), { dotfiles: 'deny', index: false }),
  );

  app.use((_req, res) => res.status(404).sendFile(path.join(paths.publicDir, '404.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[admin] error:', err && err.message);
    if (res.headersSent) return;
    res.status(err.status && err.status < 500 ? err.status : 500).json({ ok: false, error: 'Something went wrong.' });
  });

  return app;
}

module.exports = { createAdminApp };