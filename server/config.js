'use strict';
/**
 * Central configuration for the Ebenezer H.S. School App.
 * Every path, role and limit lives here so all dashboards stay interconnected.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'database');
const STORAGE = path.join(ROOT, 'storage');

/** One Excel file per class: database/students/<label>.xlsx  (KG 1 ... Class 12) */
const CLASSES = Object.freeze([
  'KG 1',
  'KG 2',
  ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
]);

const IS_PROD = process.env.NODE_ENV === 'production';

module.exports = Object.freeze({
  ROOT,
  IS_PROD,
  PORT: Number(process.env.PORT) || 3000,
  ADMIN_PORT: Number(process.env.ADMIN_PORT) || 4000,
  /** Comma separated list of IPs allowed to open the Admin Panel (empty = any). */
  ADMIN_ALLOWED_IPS: (process.env.ADMIN_ALLOWED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** Cookie SameSite policy ('strict' recommended). */
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE || 'strict').toLowerCase(),

  SESSION: Object.freeze({
    IDLE_MS: 2 * 60 * 60 * 1000, // auto-logout after 2h of inactivity
    MAX_MS: 12 * 60 * 60 * 1000, // hard limit 12h
  }),
  ADMIN_SESSION: Object.freeze({
    IDLE_MS: 30 * 60 * 1000, // admin: 30 min inactivity
    MAX_MS: 4 * 60 * 60 * 1000,
  }),
  LOGIN: Object.freeze({
    MAX_FAILS: 5, // per account + login-type
    LOCK_MS: 15 * 60 * 1000,
  }),

  CHAT: Object.freeze({
    RETENTION_DAYS: 60, // every message auto-deletes at midnight after 60 days
  }),

  CLASSES,

  paths: Object.freeze({
    db: DB,
    backups: path.join(DB, '_backups'),
    students: path.join(DB, 'students'),
    teachers: path.join(DB, 'teachers', 'teachers.xlsx'),
    staff: path.join(DB, 'staff', 'staff.xlsx'),
    admin: path.join(DB, 'admin', 'admin.xlsx'),

    storage: STORAGE,
    studentPhotos: path.join(STORAGE, 'All students pictures'),
    teacherPhotos: path.join(STORAGE, 'teachers picture'),
    logo: path.join(STORAGE, 'school logo'),
    icons: path.join(STORAGE, 'icons'),

    publicDir: path.join(ROOT, 'public'),
    appDir: path.join(ROOT, 'app'),
    adminDir: path.join(ROOT, 'admin-panel'),
  }),

  /** Login types shown on the main login screen (Admin is NOT here – separate site). */
  ROLES: Object.freeze({
    student: Object.freeze({ label: 'Student', home: '/student/' }),
    teacher: Object.freeze({ label: 'Teacher', home: '/teacher/' }),
    classteacher: Object.freeze({ label: 'Class Teacher', home: '/class-teacher/' }),
    principal: Object.freeze({ label: 'Principal', home: '/principal/' }),
    administrative: Object.freeze({ label: 'Administrative', home: '/administrative/' }),
  }),
});
