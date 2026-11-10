'use strict';
/**
 * Profile API – always re-reads Excel so edits by Admin/Principal show up live.
 * Used by the "Profile" page in every dashboard's slide-out menu.
 */
const express = require('express');
const db = require('../lib/db');
const { requireApiRole } = require('../lib/middleware');

module.exports = function profileRouter({ sessions }) {
  const router = express.Router();

  router.get('/me', requireApiRole('*'), async (req, res, next) => {
    try {
      const u = req.session.user;
      let row = null;
      if (u.role === 'student') row = await db.findStudentByAdmission(u.id);
      else if (u.role === 'teacher' || u.role === 'classteacher') row = await db.findTeacherByRegNo(u.id);
      else row = await db.findStaffByUsername(u.username);

      // account removed / disabled while logged in -> force logout
      if (!row || !db.isActive(row)) {
        sessions.destroy(req, res);
        return res.status(401).json({ ok: false, error: 'Your account is no longer active.' });
      }
      const profile = db.publicProfile(row);
      if (u.role !== 'student') delete profile.Username;
      return res.json({ ok: true, role: u.role, profile });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
