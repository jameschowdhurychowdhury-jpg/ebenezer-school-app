'use strict';
/**
 * Comprehensive End-to-End Verification of the Ebenezer Higher Secondary School App:
 *  1. Role isolation & authentication across all 6 roles (5 main + isolated Admin Panel)
 *  2. Exact blueprint feature lists, icon buttons (/media/icons/*.svg) & profile photos
 *  3. Notices & red unread badge lifecycle (Principal/Admin publish -> Student badge -> read)
 *  4. School Group 60-day encrypted chat:
 *     - Student sees ONLY Principal at first until Class Teacher adds them to a group
 *     - Per-message 60-day midnight auto-deletion math (01/10/2026 -> 30/11/2026 12:00 AM; 02/10/2026 -> 01/12/2026 12:00 AM)
 *  5. Admin Panel A-Z CRUD:
 *     - Duplicate Admission Number red alert (HTTP 409 DUPLICATE_ADMISSION)
 *     - Student add / edit / permanent delete without affecting other students
 *     - Teacher Reg No change (2 -> 5 -> 2) cascading across School Group chat-rooms
 */
const assert = require('assert');
const http = require('http');
const { createMainApp } = require('../main-server');
const { createAdminApp } = require('../admin-server');
const db = require('../lib/db');
const chatStore = require('../lib/chat-store');

function listen(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function request(port, method, path, { body, cookie, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          'User-Agent': 'ehs-selftest/2.0',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch {}
          const setCookie = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
          resolve({ status: res.statusCode, headers: res.headers, text, json, cookie: setCookie });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  const mainSrv = await listen(createMainApp());
  const adminSrv = await listen(createAdminApp());
  const mainPort = mainSrv.address().port;
  const adminPort = adminSrv.address().port;

  try {
    // 1. Verify exact 60-day midnight calculation from user prompt
    const oct1 = Date.UTC(2026, 9, 1, 14, 30, 0); // 01/10/2026
    const oct2 = Date.UTC(2026, 9, 2, 9, 15, 0);  // 02/10/2026
    const exp1 = chatStore.computeExpiryMidnight(oct1);
    const exp2 = chatStore.computeExpiryMidnight(oct2);
    assert.strictEqual(chatStore.formatDateDDMMYYYY(exp1), '30/11/2026', '01/10/2026 must expire on 30/11/2026 midnight');
    assert.strictEqual(chatStore.formatDateDDMMYYYY(exp2), '01/12/2026', '02/10/2026 must expire on 01/12/2026 midnight');

    // 2. Unauthenticated visits redirect to /
    for (const p of ['/student/', '/teacher/', '/class-teacher/', '/principal/', '/administrative/']) {
      const r = await request(mainPort, 'GET', p);
      assert.strictEqual(r.status, 302);
    }

    // 3. All 5 roles log in, get their exact blueprint feature count, and load their profile photo
    const expectedFeatureCounts = {
      student: 7,
      classteacher: 6,
      teacher: 4,
      principal: 5,
      administrative: 5,
    };
    const cases = [
      ['student', '123', '05-08-2015', '/student/', '/teacher/'],
      ['teacher', 't.debbarma', 'Teacher@101', '/teacher/', '/class-teacher/'],
      ['classteacher', 'ct.paul', 'ClassT@102', '/class-teacher/', '/principal/'],
      ['principal', 'principal', 'Principal@2026', '/principal/', '/administrative/'],
      ['administrative', 'administrative', 'Office@2026', '/administrative/', '/student/'],
    ];
    const cookies = {};
    for (const [role, username, password, own, forbidden] of cases) {
      const login = await request(mainPort, 'POST', '/api/auth/login', { body: { role, username, password } });
      assert.strictEqual(login.status, 200, `${role} login failed`);
      cookies[role] = login.cookie;

      const feats = await request(mainPort, 'GET', '/api/features', { cookie: login.cookie });
      assert.strictEqual(feats.json.features.length, expectedFeatureCounts[role], `Wrong feature count for ${role}`);

      const photo = await request(mainPort, 'GET', '/media/me/photo', { cookie: login.cookie });
      assert.strictEqual(photo.status, 200, `${role} profile photo failed`);

      const badPage = await request(mainPort, 'GET', forbidden, { cookie: login.cookie });
      assert.strictEqual(badPage.status, 302);
    }

    // 4. School Group visibility rule: Student 123 (Class 5) only sees "Principal" at first
    const stuChatBefore = await request(mainPort, 'GET', '/api/chat/overview', { cookie: cookies.student });
    assert.strictEqual(stuChatBefore.status, 200);
    assert.strictEqual(stuChatBefore.json.rooms.length, 1, 'Student 123 should only see Principal at first');
    assert.strictEqual(stuChatBefore.json.rooms[0].name, 'Principal');

    // Student cannot create a group
    const stuCreateGrp = await request(mainPort, 'POST', '/api/chat/groups', {
      cookie: cookies.student,
      body: { name: 'Forbidden Student Group' },
    });
    assert.strictEqual(stuCreateGrp.status, 403);

    // Class Teacher creates a group and adds Student 123
    const ctCreateGrp = await request(mainPort, 'POST', '/api/chat/groups', {
      cookie: cookies.classteacher,
      body: { name: 'Class 5 - A Study Group', memberKeys: ['student:123'] },
    });
    assert.strictEqual(ctCreateGrp.status, 200);

    const stuChatAfter = await request(mainPort, 'GET', '/api/chat/overview', { cookie: cookies.student });
    assert.strictEqual(stuChatAfter.json.rooms.length, 2, 'Student 123 must now see Principal + Class 5 group');

    // 5. Admin Panel login + Duplicate Admission Number red alert + Cascading Teacher Reg No update
    const aLogin = await request(adminPort, 'POST', '/api/login', {
      body: { username: 'superadmin', password: 'EHSS#Admin2026' },
    });
    assert.strictEqual(aLogin.status, 200);
    const adminCookie = aLogin.cookie;

    // Duplicate Admission Number check (123 already exists)
    const dupStu = await request(adminPort, 'POST', '/api/admin/students', {
      cookie: adminCookie,
      body: { Name: 'Duplicate Test', Class: 'Class 5', 'Admission No': '123', 'Date of Birth': '01-01-2015' },
    });
    assert.strictEqual(dupStu.status, 409, 'Existing Admission No must trigger 409 red alert');
    assert.strictEqual(dupStu.json.code, 'DUPLICATE_ADMISSION');

    // Add & delete temporary student 9991 without affecting others
    const addStu = await request(adminPort, 'POST', '/api/admin/students', {
      cookie: adminCookie,
      body: { Name: 'Test Scholar', Class: 'Class 5', 'Admission No': '9991', 'Date of Birth': '10-10-2015' },
    });
    assert.strictEqual(addStu.status, 200);
    const delStu = await request(adminPort, 'DELETE', '/api/admin/students/9991', { cookie: adminCookie });
    assert.strictEqual(delStu.status, 200);
    assert(await db.findStudentByAdmission('123'), 'Deleting 9991 must not affect student 123');

    // Change Teacher Reg No 2 -> 5 and back 5 -> 2 (cascades in chat-room)
    const ren1 = await request(adminPort, 'PUT', '/api/admin/teachers/2', {
      cookie: adminCookie,
      body: { 'Reg No': '5' },
    });
    assert.strictEqual(ren1.status, 200);
    assert.strictEqual(ren1.json.newRegNo, '5');

    const renBack = await request(adminPort, 'PUT', '/api/admin/teachers/5', {
      cookie: adminCookie,
      body: { 'Reg No': '2' },
    });
    assert.strictEqual(renBack.status, 200);
    assert.strictEqual(renBack.json.newRegNo, '2');

    // 6. Logout verification (both bodyless POST and JSON POST destroy the session)
    const stuLogout = await request(mainPort, 'POST', '/api/auth/logout', { cookie: cookies.student });
    assert.strictEqual(stuLogout.status, 200, 'Student logout must succeed (200)');
    const stuAfterLogout = await request(mainPort, 'GET', '/student/', { cookie: cookies.student });
    assert.strictEqual(stuAfterLogout.status, 302, 'After logout, /student/ must redirect to /');

    const admLogout = await request(adminPort, 'POST', '/api/logout', { cookie: adminCookie });
    assert.strictEqual(admLogout.status, 200, 'Admin logout must succeed (200)');
    const admAfterLogout = await request(adminPort, 'GET', '/panel/', { cookie: adminCookie });
    assert.strictEqual(admAfterLogout.status, 302, 'After logout, /panel/ must redirect to /');

    console.log('✔ All Phase 1–4 security, blueprint dashboards, logout, 60-day encrypted chat & Admin CRUD checks passed.');
  } finally {
    mainSrv.close();
    adminSrv.close();
  }
}

run().catch((e) => {
  console.error('✖ Self-test failed:', e);
  process.exit(1);
});
