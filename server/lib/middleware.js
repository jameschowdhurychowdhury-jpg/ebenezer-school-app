'use strict';
/**
 * Shared HTTP middleware: security headers, CSRF/origin checks, role guards.
 */
const helmet = require('helmet');
const { IS_PROD } = require('../config');

/** Strict security headers + Content-Security-Policy (no inline scripts, no 3rd-party code). */
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: IS_PROD ? ["'none'"] : ["'self'", '*'],
        ...(IS_PROD ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    frameguard: IS_PROD ? { action: 'deny' } : false,
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
}

/** Never let browsers / proxies cache private pages or API answers. */
function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
}

/**
 * Blocks cross-site state-changing requests (CSRF) on top of SameSite cookies.
 * Uses Fetch-Metadata when available, falls back to Origin vs Host.
 */
function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const site = req.get('sec-fetch-site');
  if (site) {
    if (site === 'same-origin' || site === 'none') return next();
    return res.status(403).json({ ok: false, error: 'Request blocked.' });
  }
  const origin = req.get('origin');
  if (origin) {
    try {
      const host = req.get('x-forwarded-host') || req.get('host');
      if (new URL(origin).host !== host) return res.status(403).json({ ok: false, error: 'Request blocked.' });
    } catch {
      return res.status(403).json({ ok: false, error: 'Request blocked.' });
    }
  }
  return next();
}

/** API POST bodies must be JSON (stops classic HTML-form CSRF). */
function jsonOnly(req, res, next) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const len = Number(req.get('content-length') || 0);
    if (len > 0 && !req.is('application/json')) {
      return res.status(415).json({ ok: false, error: 'Unsupported request.' });
    }
  }
  next();
}

/** Attaches req.session (or null) from the given store. */
function loadSession(store) {
  return (req, _res, next) => {
    req.session = store.get(req);
    next();
  };
}

/**
 * Guard for API routes.
 * @param {string[]|'*'} roles
 */
function requireApiRole(roles) {
  return (req, res, next) => {
    const s = req.session;
    if (!s) return res.status(401).json({ ok: false, error: 'Please log in again.' });
    if (roles !== '*' && !roles.includes(s.user.role)) {
      return res.status(403).json({ ok: false, error: 'Not allowed.' });
    }
    next();
  };
}

/** Guard for HTML pages – unauthenticated users are sent to the login screen. */
function requirePageRole(roles, loginPath = '/') {
  return (req, res, next) => {
    const s = req.session;
    if (!s || (roles !== '*' && !roles.includes(s.user.role))) return res.redirect(302, loginPath);
    noStore(req, res, next);
  };
}

module.exports = {
  securityHeaders,
  noStore,
  sameOriginOnly,
  jsonOnly,
  loadSession,
  requireApiRole,
  requirePageRole,
};
