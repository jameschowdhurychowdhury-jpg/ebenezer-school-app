'use strict';
/**
 * Images: school logo (public), own profile photo (private), website icons (public).
 * Photos are never exposed as a public folder – they are streamed only to the owner.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const { paths, CLASSES } = require('../config');
const { requireApiRole } = require('../lib/middleware');

const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
const DEFAULT_AVATAR = path.join(paths.publicDir, 'assets', 'img', 'avatar.svg');

/** Finds "<dir>/<base>.(png|jpg|jpeg|webp)" safely (base is pre-validated). */
function findImage(dir, base) {
  for (const ext of IMG_EXT) {
    const p = path.join(dir, `${base}${ext}`);
    if (p.startsWith(dir + path.sep) && fs.existsSync(p)) return p;
  }
  return null;
}

/** First image in the school-logo folder (logo.png preferred). */
function findLogo() {
  const preferred = findImage(paths.logo, 'logo');
  if (preferred) return preferred;
  try {
    const f = fs.readdirSync(paths.logo).find((n) => IMG_EXT.includes(path.extname(n).toLowerCase()));
    return f ? path.join(paths.logo, f) : null;
  } catch {
    return null;
  }
}

function photoFor(user) {
  const safeId = String(user.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeId) return null;
  if (user.role === 'student') {
    if (!CLASSES.includes(user.classFile)) return null;
    return findImage(path.join(paths.studentPhotos, user.classFile), safeId);
  }
  // teachers: "<RegNo>.jpg"; principal/administrative: "principal.jpg" / "administrative.jpg"
  const base = user.role === 'principal' || user.role === 'administrative' ? user.role : safeId;
  return findImage(paths.teacherPhotos, base);
}

module.exports = function mediaRouter() {
  const router = express.Router();

  router.get('/logo', (_req, res) => {
    const logo = findLogo();
    if (!logo) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(logo);
  });

  router.get('/me/photo', requireApiRole('*'), (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    return res.sendFile(photoFor(req.session.user) || DEFAULT_AVATAR);
  });

  // All website icon buttons live in storage/icons
  router.use(
    '/icons',
    express.static(paths.icons, { dotfiles: 'deny', index: false, fallthrough: false, maxAge: '1d' }),
  );

  return router;
};

module.exports.photoFor = photoFor;
module.exports.findLogo = findLogo;
