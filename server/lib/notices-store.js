'use strict';
/**
 * Notices & Announcements store.
 * Controlled by Admin Panel and Principal / Administrative Dashboard.
 * Tracks unread status per user ID so the red badge on the Notices icon is live.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { paths } = require('../config');

const FILE = path.join(paths.db, 'notices', 'notices.json');

function ensureLoaded() {
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const now = Date.now();
    const initial = {
      notices: [
        {
          id: 'ntc-welcome-2026',
          title: 'Welcome to the Official Ebenezer H.S. School App',
          body: 'All students, teachers, class teachers, principal and administrative staff can now access their dashboards, check official announcements, and communicate securely via the School Group.',
          authorRole: 'Principal',
          authorName: 'Dr. Elizabeth Halam (Principal)',
          priority: 'important',
          createdAt: now - 3600 * 1000 * 12,
          readBy: [],
        },
        {
          id: 'ntc-exam-schedule',
          title: 'Term Assessment & Attendance Submission Reminder',
          body: 'Class Teachers are requested to verify class lists. Students should check the Notices board regularly for upcoming assessment schedules and holiday updates.',
          authorRole: 'Admin',
          authorName: 'School Administration',
          priority: 'normal',
          createdAt: now - 3600 * 1000 * 3,
          readBy: [],
        },
      ],
    };
    fs.writeFileSync(FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function listForUser(uid) {
  const data = ensureLoaded();
  return data.notices
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      authorRole: n.authorRole,
      authorName: n.authorName,
      priority: n.priority || 'normal',
      createdAt: n.createdAt,
      unread: !Array.isArray(n.readBy) || !n.readBy.includes(uid),
    }));
}

function unreadCount(uid) {
  return listForUser(uid).filter((n) => n.unread).length;
}

function markAllRead(uid) {
  const data = ensureLoaded();
  let changed = false;
  for (const n of data.notices) {
    if (!Array.isArray(n.readBy)) n.readBy = [];
    if (!n.readBy.includes(uid)) {
      n.readBy.push(uid);
      changed = true;
    }
  }
  if (changed) save(data);
}

function publish({ title, body, authorRole, authorName, priority = 'normal' }) {
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t || !b) throw new Error('Title and message body are required.');
  const data = ensureLoaded();
  const item = {
    id: `ntc-${crypto.randomBytes(6).toString('hex')}`,
    title: t.slice(0, 160),
    body: b.slice(0, 4000),
    authorRole: String(authorRole || 'Admin'),
    authorName: String(authorName || 'Administration'),
    priority: priority === 'important' ? 'important' : 'normal',
    createdAt: Date.now(),
    readBy: [],
  };
  data.notices.unshift(item);
  save(data);
  return item;
}

function remove(id) {
  const data = ensureLoaded();
  const before = data.notices.length;
  data.notices = data.notices.filter((n) => n.id !== id);
  if (data.notices.length !== before) save(data);
  return data.notices.length !== before;
}

module.exports = {
  listForUser,
  unreadCount,
  markAllRead,
  publish,
  remove,
};
