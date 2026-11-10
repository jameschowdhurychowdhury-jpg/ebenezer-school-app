'use strict';
/**
 * Main-site authentication: Student / Teacher / Class Teacher / Principal / Administrative.
 * (Admin Panel has its own, completely separate auth in admin-server.js)
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../lib/db');
const { normalizeDob } = require('../lib/dates');
const { verifyPassword, safeEqual } = require('../lib/security');
const { ROLES } = require('../config');

const GENERIC_FAIL = 'Invalid credentials for the selected login type.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- credential checks (each returns a session user or null) ---------- */

async function authStudent(username, password) {
  const student = await db.findStudentByAdmission(username);
  const typed = normalizeDob(password);
  const stored = student ? normalizeDob(student['Date of Birth']) : null;
  // always run the comparison so timing does not reveal whether the account exists
  const match = safeEqual(typed || 'x', stored || 'y') && !!typed && !!stored;
  if (!student || !match || !db.isActive(student)) return null;
  return {
    uid: `student:${db.normId(student['Admission No'])}`,
    role: 'student',
    id: db.normId(student['Admission No']),
    name: student.Name,
    classFile: student._classFile,
  };
}

const TEACHER_ROLE_MAP = { teacher: 'teacher', 'class teacher': 'classteacher', classteacher: 'classteacher' };

async function authTeacher(role, username, password) {
  const t = await db.findTeacherByUsername(username);
  const ok = await verifyPassword(password, t ? t.Password : null);
  if (!t || !ok || !db.isActive(t)) return null;
  const rowRole = TEACHER_ROLE_MAP[String(t.Role || '').trim().toLowerCase()];
  if (rowRole !== role) return null; // a Teacher cannot use "Class Teacher login" and vice-versa
  return {
    uid: `teacher:${db.normId(t['Reg No'])}`,
    role,
    id: db.normId(t['Reg No']),
    name: t.Name,
    username: db.normUsername(t.Username),
  };
}

async function authStaff(role, username, password) {
  const s = await db.findStaffByUsername(username);
  const ok = await verifyPassword(password, s ? s.Password : null);
  if (!s || !ok || !db.isActive(s)) return null;
  if (String(s.Role || '').trim().toLowerCase() !== role) return null;
  return {
    uid: `staff:${role}`,
    role,
    id: s['Chat ID'] || ROLES[role].label,
    name: s.Name,
    username: db.normUsername(s.Username),
  };
}

/* ------------------------------- router ------------------------------- */

module.exports = function authRouter({ sessions, lockout }) {
  const router = express.Router();

  // IP-level limiter on top of the per-account lockout
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { ok: false, error: 'Too many login attempts from this device. Please wait 15 minutes.' },
  });

  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const { role, username, password } = req.body || {};
      if (
        typeof role !== 'string' ||
        !Object.prototype.hasOwnProperty.call(ROLES, role) ||
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        !username.trim() ||
        !password ||
        username.length > 64 ||
        password.length > 128
      ) {
        return res.status(400).json({ ok: false, error: 'Please fill in all fields correctly.' });
      }

      const lockKey = `${role}:${username.trim().toLowerCase()}`;
      const left = lockout.remainingMs(lockKey);
      if (left > 0) {
        return res.status(429).json({
          ok: false,
          error: `Too many failed attempts. Try again in ${Math.ceil(left / 60000)} minute(s).`,
        });
      }

      let user = null;
      if (role === 'student') user = await authStudent(username, password);
      else if (role === 'teacher' || role === 'classteacher') user = await authTeacher(role, username, password);
      else user = await authStaff(role, username, password);

      if (!user) {
        lockout.fail(lockKey);
        await sleep(250 + Math.floor(Math.random() * 250));
        return res.status(401).json({ ok: false, error: GENERIC_FAIL });
      }

      lockout.clear(lockKey);
      sessions.create(req, res, user);
      return res.json({ ok: true, redirect: ROLES[role].home });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/logout', (req, res) => {
    sessions.destroy(req, res);
    res.json({ ok: true, redirect: '/' });
  });

  router.get('/me', (req, res) => {
    const s = req.session;
    if (!s) return res.status(401).json({ ok: false });
    const { role, id, name } = s.user;
    return res.json({ ok: true, role, roleLabel: ROLES[role].label, id, name, home: ROLES[role].home });
  });

  return router;
};
