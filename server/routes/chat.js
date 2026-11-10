'use strict';
/**
 * School Group (WhatsApp-style Encrypted 60-Day Chat-Room) API.
 */
const express = require('express');
const chatStore = require('../lib/chat-store');
const { requireApiRole } = require('../lib/middleware');
const { ROLES } = require('../config');

function actorFromSession(user) {
  return {
    uid: user.uid,
    role: user.role,
    roleLabel: user.role === 'admin' ? 'Admin' : (ROLES[user.role] && ROLES[user.role].label) || user.role,
    id: user.id,
    name: user.name,
  };
}

module.exports = function chatRouter() {
  const router = express.Router();

  router.get('/overview', requireApiRole('*'), async (req, res, next) => {
    try {
      const data = await chatStore.getOverviewForUser(actorFromSession(req.session.user));
      res.json({ ok: true, ...data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/rooms/:roomId/messages', requireApiRole('*'), async (req, res) => {
    try {
      const messages = await chatStore.getRoomMessages(
        actorFromSession(req.session.user),
        String(req.params.roomId || ''),
      );
      res.json({ ok: true, messages });
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message || 'Cannot load messages.' });
    }
  });

  router.post('/messages', requireApiRole('*'), async (req, res) => {
    try {
      const message = await chatStore.sendMessage(actorFromSession(req.session.user), req.body || {});
      res.json({ ok: true, message });
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message || 'Cannot send message.' });
    }
  });

  router.post('/groups', requireApiRole(['classteacher', 'principal', 'administrative', 'admin']), async (req, res) => {
    try {
      const group = await chatStore.createGroup(actorFromSession(req.session.user), req.body || {});
      res.json({ ok: true, group });
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message || 'Cannot create group.' });
    }
  });

  router.post('/groups/:groupId/members', requireApiRole(['classteacher', 'principal', 'administrative', 'admin']), async (req, res) => {
    try {
      const result = await chatStore.addMemberToGroup(actorFromSession(req.session.user), {
        ...(req.body || {}),
        groupId: String(req.params.groupId || ''),
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message || 'Cannot add member.' });
    }
  });

  return router;
};
