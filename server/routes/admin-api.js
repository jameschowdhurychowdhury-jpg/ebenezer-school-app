'use strict';
/**
 * Admin Control Panel A-Z Management API:
 *  - Add Teacher / Add Class Teacher (with unique Chat Reg No check)
 *  - Add Student (choose class KG 1 .. Class 12; replace whole class Excel OR add/edit student)
 *  - Student Data (category-wise by Class, live edit, permanent delete without affecting others)
 *  - Teachers Data (live edit, permanent delete, cascading Chat Reg No update everywhere)
 */
const express = require('express');
const db = require('../lib/db');
const chatStore = require('../lib/chat-store');
const { CLASSES } = require('../config');
const { requireApiRole } = require('../lib/middleware');

module.exports = function adminApiRouter() {
  const router = express.Router();
  router.use(requireApiRole(['admin']));

  /* ---------- Classes & Students ---------- */
  router.get('/classes', async (_req, res, next) => {
    try {
      const all = await db.allStudents();
      const classes = CLASSES.map((cls) => ({
        name: cls,
        count: all.filter((s) => s._classFile === cls && db.isActive(s)).length,
      }));
      res.json({ ok: true, classes });
    } catch (err) {
      next(err);
    }
  });

  router.get('/students', async (req, res, next) => {
    try {
      const cls = String(req.query.class || '').trim();
      const rows = cls && CLASSES.includes(cls) ? await db.studentsByClass(cls) : await db.allStudents();
      const students = rows.filter(db.isActive).map((s) => ({
        ...db.publicProfile(s),
        Class: s.Class || s._classFile,
      }));
      res.json({ ok: true, classes: CLASSES, students });
    } catch (err) {
      next(err);
    }
  });

  router.post('/students', async (req, res) => {
    try {
      const student = await db.addStudent(req.body || {});
      res.json({ ok: true, student });
    } catch (err) {
      const status = err.code === 'DUPLICATE_ADMISSION' ? 409 : 400;
      res.status(status).json({
        ok: false,
        code: err.code || 'ERROR',
        error: err.message || 'Could not register student.',
      });
    }
  });

  router.put('/students/:admissionNo', async (req, res) => {
    try {
      const student = await db.updateStudent(req.params.admissionNo, req.body || {});
      res.json({ ok: true, student });
    } catch (err) {
      const status = err.code === 'DUPLICATE_ADMISSION' ? 409 : err.status || 400;
      res.status(status).json({
        ok: false,
        code: err.code || 'ERROR',
        error: err.message || 'Could not update student.',
      });
    }
  });

  router.delete('/students/:admissionNo', async (req, res, next) => {
    try {
      const removed = await db.deleteStudent(req.params.admissionNo);
      if (!removed) return res.status(404).json({ ok: false, error: 'Student not found.' });
      return res.json({ ok: true, removed: true });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/students/replace-class', async (req, res) => {
    try {
      const { className, students } = req.body || {};
      const replaced = await db.replaceClassStudents(String(className || '').trim(), students);
      res.json({ ok: true, className, count: replaced.length, students: replaced });
    } catch (err) {
      const status = err.code === 'DUPLICATE_ADMISSION' ? 409 : 400;
      res.status(status).json({
        ok: false,
        code: err.code || 'ERROR',
        error: err.message || 'Could not replace class Excel data.',
      });
    }
  });

  /* ---------- Teachers & Class Teachers ---------- */
  router.get('/teachers', async (_req, res, next) => {
    try {
      const rows = await db.allTeachers();
      const teachers = rows.filter(db.isActive).map(db.publicProfile);
      res.json({ ok: true, teachers });
    } catch (err) {
      next(err);
    }
  });

  router.post('/teachers', async (req, res) => {
    try {
      const roleType = req.body && req.body.roleType === 'Class Teacher' ? 'Class Teacher' : 'Teacher';
      const result = await db.addTeacher(req.body || {}, roleType);
      res.json({ ok: true, ...result });
    } catch (err) {
      const status = err.code === 'DUPLICATE_REG_NO' || err.code === 'DUPLICATE_USERNAME' ? 409 : 400;
      res.status(status).json({
        ok: false,
        code: err.code || 'ERROR',
        error: err.message || 'Could not register teacher.',
      });
    }
  });

  router.put('/teachers/:regNo', async (req, res) => {
    try {
      const result = await db.updateTeacher(req.params.regNo, req.body || {});
      if (result.oldRegNo !== result.newRegNo) {
        // Cascade chat-room code change everywhere in School Group!
        chatStore.renameTeacherChatId(result.oldRegNo, result.newRegNo);
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      const status = err.code === 'DUPLICATE_REG_NO' ? 409 : err.status || 400;
      res.status(status).json({
        ok: false,
        code: err.code || 'ERROR',
        error: err.message || 'Could not update teacher.',
      });
    }
  });

  router.delete('/teachers/:regNo', async (req, res, next) => {
    try {
      const removed = await db.deleteTeacher(req.params.regNo);
      if (!removed) return res.status(404).json({ ok: false, error: 'Teacher not found.' });
      return res.json({ ok: true, removed: true });
    } catch (err) {
      return next(err);
    }
  });

  /* ---------- Direct Excel (.xlsx) Download / Export ---------- */
  router.get('/export/teachers', (_req, res) => {
    const { paths } = require('../config');
    return res.download(paths.teachers, 'teachers.xlsx');
  });

  router.get('/export/staff', (_req, res) => {
    const { paths } = require('../config');
    return res.download(paths.staff, 'staff.xlsx');
  });

  router.get('/export/class/:className', (req, res) => {
    const cls = String(req.params.className || '').trim();
    if (!CLASSES.includes(cls)) return res.status(404).json({ ok: false, error: 'Invalid class.' });
    return res.download(db.studentFile(cls), `${cls}.xlsx`);
  });

  router.get('/export/publish-bundle', (_req, res) => {
    const { ROOT } = require('../config');
    const path = require('path');
    const { execFileSync } = require('child_process');
    const bundlePath = path.join('/tmp', 'ebenezer-school-app-publish.tar.gz');
    execFileSync('tar', [
      '-czf',
      bundlePath,
      '--exclude=node_modules',
      '--exclude=database/_backups',
      '-C',
      path.dirname(ROOT),
      path.basename(ROOT),
    ]);
    return res.download(bundlePath, 'ebenezer-school-app-publish.tar.gz');
  });

  return router;
};
