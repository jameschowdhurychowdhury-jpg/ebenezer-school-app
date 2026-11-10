'use strict';
/**
 * Notices & Announcements API (shared by Main App and Admin Panel).
 */
const express = require('express');
const noticesStore = require('../lib/notices-store');
const { requireApiRole } = require('../lib/middleware');

module.exports = function noticesRouter() {
  const router = express.Router();

  router.get('/unread', requireApiRole('*'), (req, res) => {
    const uid = req.session.user.uid;
    res.json({ ok: true, unread: noticesStore.unreadCount(uid) });
  });

  router.get('/', requireApiRole('*'), (req, res) => {
    const uid = req.session.user.uid;
    const list = noticesStore.listForUser(uid);
    if (req.query.markRead !== 'false') {
      noticesStore.markAllRead(uid);
    }
    res.json({ ok: true, notices: list, unread: noticesStore.unreadCount(uid) });
  });

  router.post('/', requireApiRole(['principal', 'administrative', 'admin']), (req, res) => {
    try {
      const u = req.session.user;
      const roleLabels = {
        principal: 'Principal',
        administrative: 'Administrative',
        admin: 'Admin Panel',
      };
      const item = noticesStore.publish({
        title: req.body && req.body.title,
        body: req.body && req.body.body,
        priority: req.body && req.body.priority,
        authorRole: roleLabels[u.role] || u.role,
        authorName: u.name,
      });
      res.json({ ok: true, notice: item });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || 'Could not publish notice.' });
    }
  });

  router.delete('/:id', requireApiRole(['principal', 'administrative', 'admin']), (req, res) => {
    const removed = noticesStore.remove(String(req.params.id || ''));
    res.json({ ok: true, removed });
  });

  return router;
};
