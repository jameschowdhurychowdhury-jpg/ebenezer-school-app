'use strict';
/**
 * FEATURE REGISTRY – the single source of truth for which dashboard shows which button,
 * its icon from /media/icons/, and what each status / coming-soon page says.
 */
const express = require('express');
const noticesStore = require('../lib/notices-store');
const { requireApiRole } = require('../lib/middleware');

const S = 'student';
const T = 'teacher';
const CT = 'classteacher';
const P = 'principal';
const A = 'administrative';

const FEATURES = Object.freeze({
  fees: { label: 'Fees', icon: '/media/icons/fees.svg', roles: [S], message: 'Coming soon' },
  result: { label: 'Result', icon: '/media/icons/result.svg', roles: [S], message: 'No result yet' },
  notes: { label: 'Notes', icon: '/media/icons/notes.svg', roles: [S], message: 'Notes will be available soon' },
  calendar: { label: 'Calender', icon: '/media/icons/calendar.svg', roles: [S, T, CT, P, A], message: 'Not uploaded by Admin yet!' },
  notices: { label: 'Notices', icon: '/media/icons/notices.svg', roles: [S, T, CT, P, A], message: 'Notices and Announcements' },
  chat: { label: 'School Group', icon: '/media/icons/school-group.svg', roles: [S, T, CT, P, A], message: 'School Group Chat-Room' },
  attendance: { label: 'My Attendance', icon: '/media/icons/attendance.svg', roles: [S], message: 'Not uploaded yet by your class Teacher' },
  salary: { label: 'Salary', icon: '/media/icons/salary.svg', roles: [T, CT, P, A], message: 'Coming soon' },
  'upload-result': { label: 'Upload Result', icon: '/media/icons/upload-result.svg', roles: [CT], message: 'Coming soon' },
  'class-attendance': { label: 'Class attendance', icon: '/media/icons/attendance.svg', roles: [CT], message: 'It will come soon' },
  'publish-notices': { label: 'publish Notices', icon: '/media/icons/publish-notices.svg', roles: [P, A], message: 'Coming soon' },
  settings: { label: 'Setting', icon: '/media/icons/coming-soon.svg', roles: [S, T, CT, P, A], message: 'Coming soon' },
});

/** Exact blueprint button order for each role */
const ROLE_ORDER = Object.freeze({
  student: ['fees', 'result', 'notes', 'calendar', 'notices', 'chat', 'attendance'],
  classteacher: ['salary', 'upload-result', 'chat', 'calendar', 'notices', 'class-attendance'],
  teacher: ['salary', 'chat', 'calendar', 'notices'],
  principal: ['salary', 'chat', 'calendar', 'notices', 'publish-notices'],
  administrative: ['salary', 'chat', 'calendar', 'notices', 'publish-notices'],
});

module.exports = function featuresRouter() {
  const router = express.Router();

  /** Buttons available to the logged-in role in exact blueprint order. */
  router.get('/', requireApiRole('*'), (req, res) => {
    const role = req.session.user.role;
    const order = ROLE_ORDER[role] || [];
    const list = order
      .filter((k) => FEATURES[k] && FEATURES[k].roles.includes(role))
      .map((key) => ({
        key,
        label: FEATURES[key].label,
        icon: FEATURES[key].icon,
        message: FEATURES[key].message,
      }));
    res.json({
      ok: true,
      features: list,
      unreadNotices: noticesStore.unreadCount(req.session.user.uid),
    });
  });

  /** Unread notices badge (red number) */
  router.get('/notices/unread', requireApiRole('*'), (req, res) => {
    res.json({ ok: true, unread: noticesStore.unreadCount(req.session.user.uid) });
  });

  router.get('/:key', requireApiRole('*'), (req, res) => {
    const f = Object.prototype.hasOwnProperty.call(FEATURES, req.params.key) ? FEATURES[req.params.key] : null;
    if (!f) return res.status(404).json({ ok: false, error: 'Not found.' });
    if (!f.roles.includes(req.session.user.role)) return res.status(403).json({ ok: false, error: 'Not allowed.' });
    return res.json({ ok: true, status: 'coming_soon', label: f.label, icon: f.icon, message: f.message });
  });

  return router;
};

module.exports.FEATURES = FEATURES;
module.exports.ROLE_ORDER = ROLE_ORDER;
