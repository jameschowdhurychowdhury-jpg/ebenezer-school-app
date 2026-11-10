'use strict';
/**
 * Data-access layer on top of the Excel files.
 * Every dashboard / route reads and updates people through here – never directly from Excel.
 */
const fs = require('fs');
const path = require('path');
const { readSheet, writeSheet } = require('./excel');
const { hashPassword, isHashed } = require('./security');
const { prettyDob, normalizeDob } = require('./dates');
const { CLASSES, paths } = require('../config');
const { makeAvatarSvg } = require('../scripts/generate-assets');

/* ---------------------------- Schemas ---------------------------- */
const STUDENT_HEADERS = Object.freeze([
  'Admission No',
  'Name',
  'Class',
  'Section',
  'Roll No',
  'Date of Birth',
  'Gender',
  'Blood Group',
  'House Group',
  'Residential Address',
  'PIN Code',
  'Contact Number',
  "Mother's Name",
  "Father's Name",
  'Transport Mode',
  'Hosteler / Day Scholar',
  'Status',
]);

const TEACHER_HEADERS = Object.freeze([
  'Reg No', // chat-room register number (unique) e.g. 1, 2, 3
  'Username',
  'Password', // scrypt hash (plain text typed in Excel is auto-hashed on next load)
  'Role', // "Teacher" | "Class Teacher"
  'Name',
  'Date of Birth',
  'Gender',
  'Email',
  'Phone No',
  'Residential Address',
  'PIN Code',
  'Blood Group',
  'Date of Joining',
  'Educational Qualification',
  'Subject / Department',
  'Class Teacher Of', // e.g. "Class 10 - A" (only for Class Teacher)
  'Status',
]);

const STAFF_HEADERS = Object.freeze([
  'Chat ID', // "Principal" | "Administrative"
  'Username',
  'Password',
  'Role', // "Principal" | "Administrative"
  'Name',
  'Date of Birth',
  'Gender',
  'Email',
  'Phone No',
  'Residential Address',
  'PIN Code',
  'Blood Group',
  'Date of Joining',
  'Educational Qualification',
  'Status',
]);

const ADMIN_HEADERS = Object.freeze(['Chat ID', 'Username', 'Password', 'Name', 'Status']);

/* ---------------------------- Helpers ---------------------------- */
const ID_RE = /^[A-Za-z0-9/_-]{1,30}$/;
const USERNAME_RE = /^[A-Za-z0-9._@-]{1,64}$/;

/** Normalises an ID (admission no / reg no) – returns '' if it contains anything unsafe. */
function normId(v) {
  const s = String(v ?? '').trim();
  return ID_RE.test(s) ? s.toUpperCase() : '';
}
function normUsername(v) {
  const s = String(v ?? '').trim();
  return USERNAME_RE.test(s) ? s.toLowerCase() : '';
}
const isActive = (row) => !/^(removed|inactive|deleted|blocked)$/i.test(String(row.Status || '').trim());

const studentFile = (cls) => path.join(paths.students, `${cls}.xlsx`);

function initialsOf(name) {
  const parts = String(name || 'U')
    .replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase();
}

/**
 * If someone typed a plain-text password into Excel, hash it and save it back.
 * Plain-text passwords therefore live in Excel only until the next server read.
 */
async function upgradePlainPasswords(file, headers) {
  const { rows } = await readSheet(file, headers);
  if (!rows.some((r) => r.Password && !isHashed(r.Password))) return rows;
  const updated = [];
  for (const r of rows) {
    const copy = { ...r };
    if (copy.Password && !isHashed(copy.Password)) copy.Password = await hashPassword(copy.Password);
    updated.push(copy);
  }
  await writeSheet(file, headers, updated);
  return (await readSheet(file, headers)).rows;
}

/* ---------------------------- Students --------------------------- */
async function allStudents() {
  const perClass = await Promise.all(
    CLASSES.map(async (cls) => {
      const { rows } = await readSheet(studentFile(cls), STUDENT_HEADERS);
      return rows.map((r) => ({ ...r, _classFile: cls }));
    }),
  );
  return perClass.flat();
}

async function studentsByClass(cls) {
  if (!CLASSES.includes(cls)) return [];
  const { rows } = await readSheet(studentFile(cls), STUDENT_HEADERS);
  return rows.map((r) => ({ ...r, _classFile: cls }));
}

/** Returns the student only if exactly ONE record has this admission number. */
async function findStudentByAdmission(admissionNo) {
  const key = normId(admissionNo);
  if (!key) return null;
  const matches = (await allStudents()).filter((s) => normId(s['Admission No']) === key);
  if (matches.length !== 1) {
    if (matches.length > 1) console.warn(`[db] Duplicate Admission No "${key}" found – login refused.`);
    return null;
  }
  return matches[0];
}

async function isAdmissionTaken(admissionNo, exceptAdmissionNo = '') {
  const key = normId(admissionNo);
  const except = normId(exceptAdmissionNo);
  if (!key) return false;
  return (await allStudents()).some(
    (s) => normId(s['Admission No']) === key && normId(s['Admission No']) !== except,
  );
}

async function addStudent(payload) {
  const adm = normId(payload['Admission No'] || payload.admissionNo);
  if (!adm) {
    const err = new Error('Valid Admission Number is required.');
    err.code = 'INVALID_ADMISSION';
    throw err;
  }
  if (await isAdmissionTaken(adm)) {
    const err = new Error('The Admission number is already existing in data!');
    err.code = 'DUPLICATE_ADMISSION';
    throw err;
  }
  const cls = String(payload.Class || payload.className || '').trim();
  if (!CLASSES.includes(cls)) {
    const err = new Error('Please choose a valid Class (KG 1 to Class 12).');
    err.code = 'INVALID_CLASS';
    throw err;
  }
  const rawDob = String(payload['Date of Birth'] || payload.dob || '01-01-2012').trim();
  const formattedDob = prettyDob(rawDob) || rawDob;

  const newRow = {
    'Admission No': adm,
    Name: String(payload.Name || payload.name || '').trim(),
    Class: cls,
    Section: String(payload.Section || payload.section || 'A').trim(),
    'Roll No': String(payload['Roll No'] || payload.rollNo || '').trim(),
    'Date of Birth': formattedDob,
    Gender: String(payload.Gender || payload.gender || '').trim(),
    'Blood Group': String(payload['Blood Group'] || payload.bloodGroup || '').trim(),
    'House Group': String(payload['House Group'] || payload.houseGroup || '').trim(),
    'Residential Address': String(payload['Residential Address'] || payload.address || '').trim(),
    'PIN Code': String(payload['PIN Code'] || payload.pinCode || '').trim(),
    'Contact Number': String(payload['Contact Number'] || payload.contactNumber || '').trim(),
    "Mother's Name": String(payload["Mother's Name"] || payload.motherName || '').trim(),
    "Father's Name": String(payload["Father's Name"] || payload.fatherName || '').trim(),
    'Transport Mode': String(payload['Transport Mode'] || payload.transportMode || '').trim(),
    'Hosteler / Day Scholar': String(payload['Hosteler / Day Scholar'] || payload.scholarType || 'Day Scholar').trim(),
    Status: 'Active',
  };
  if (!newRow.Name) throw new Error('Student Name is required.');

  const file = studentFile(cls);
  const { rows } = await readSheet(file, STUDENT_HEADERS);
  await writeSheet(file, STUDENT_HEADERS, [...rows, newRow], cls);

  // Ensure student profile picture exists in storage/All students pictures/<Class>/<AdmissionNo>.svg
  const picDir = path.join(paths.studentPhotos, cls);
  fs.mkdirSync(picDir, { recursive: true });
  const picPath = path.join(picDir, `${adm}.svg`);
  if (!fs.existsSync(picPath)) {
    fs.writeFileSync(picPath, makeAvatarSvg(initialsOf(newRow.Name), '#1e3a8a'));
  }
  return publicProfile({ ...newRow, _classFile: cls });
}

async function updateStudent(originalAdmissionNo, payload) {
  const origKey = normId(originalAdmissionNo);
  const existing = await findStudentByAdmission(origKey);
  if (!existing) {
    const err = new Error('Student not found.');
    err.status = 404;
    throw err;
  }
  const newAdm = normId(payload['Admission No'] ?? payload.admissionNo ?? existing['Admission No']);
  if (!newAdm) throw new Error('Valid Admission Number is required.');
  if (newAdm !== origKey && (await isAdmissionTaken(newAdm, origKey))) {
    const err = new Error('The Admission number is already existing in data!');
    err.code = 'DUPLICATE_ADMISSION';
    throw err;
  }
  const targetClass = String(payload.Class ?? payload.className ?? existing.Class ?? existing._classFile).trim();
  if (!CLASSES.includes(targetClass)) throw new Error('Invalid Class selected.');

  const rawDob = String(payload['Date of Birth'] ?? payload.dob ?? existing['Date of Birth']).trim();
  const updatedRow = {
    'Admission No': newAdm,
    Name: String(payload.Name ?? payload.name ?? existing.Name).trim(),
    Class: targetClass,
    Section: String(payload.Section ?? payload.section ?? existing.Section).trim(),
    'Roll No': String(payload['Roll No'] ?? payload.rollNo ?? existing['Roll No']).trim(),
    'Date of Birth': prettyDob(rawDob) || rawDob,
    Gender: String(payload.Gender ?? payload.gender ?? existing.Gender).trim(),
    'Blood Group': String(payload['Blood Group'] ?? payload.bloodGroup ?? existing['Blood Group']).trim(),
    'House Group': String(payload['House Group'] ?? payload.houseGroup ?? existing['House Group']).trim(),
    'Residential Address': String(payload['Residential Address'] ?? payload.address ?? existing['Residential Address']).trim(),
    'PIN Code': String(payload['PIN Code'] ?? payload.pinCode ?? existing['PIN Code']).trim(),
    'Contact Number': String(payload['Contact Number'] ?? payload.contactNumber ?? existing['Contact Number']).trim(),
    "Mother's Name": String(payload["Mother's Name"] ?? payload.motherName ?? existing["Mother's Name"]).trim(),
    "Father's Name": String(payload["Father's Name"] ?? payload.fatherName ?? existing["Father's Name"]).trim(),
    'Transport Mode': String(payload['Transport Mode'] ?? payload.transportMode ?? existing['Transport Mode']).trim(),
    'Hosteler / Day Scholar': String(payload['Hosteler / Day Scholar'] ?? payload.scholarType ?? existing['Hosteler / Day Scholar']).trim(),
    Status: 'Active',
  };

  const oldClass = existing._classFile;
  if (oldClass === targetClass) {
    const file = studentFile(oldClass);
    const { rows } = await readSheet(file, STUDENT_HEADERS);
    const nextRows = rows.map((r) => (normId(r['Admission No']) === origKey ? updatedRow : r));
    await writeSheet(file, STUDENT_HEADERS, nextRows, oldClass);
  } else {
    // Move between class Excel files without affecting other records
    const oldFile = studentFile(oldClass);
    const { rows: oldRows } = await readSheet(oldFile, STUDENT_HEADERS);
    await writeSheet(
      oldFile,
      STUDENT_HEADERS,
      oldRows.filter((r) => normId(r['Admission No']) !== origKey),
      oldClass,
    );
    const newFile = studentFile(targetClass);
    const { rows: newRows } = await readSheet(newFile, STUDENT_HEADERS);
    await writeSheet(newFile, STUDENT_HEADERS, [...newRows, updatedRow], targetClass);
  }
  return publicProfile({ ...updatedRow, _classFile: targetClass });
}

async function deleteStudent(admissionNo) {
  const key = normId(admissionNo);
  const existing = await findStudentByAdmission(key);
  if (!existing) return false;
  const cls = existing._classFile;
  const file = studentFile(cls);
  const { rows } = await readSheet(file, STUDENT_HEADERS);
  const nextRows = rows.filter((r) => normId(r['Admission No']) !== key);
  await writeSheet(file, STUDENT_HEADERS, nextRows, cls);
  return true;
}

/** Replaces the whole class Excel list after verifying no duplicate Admission Numbers exist. */
async function replaceClassStudents(cls, incomingRows) {
  if (!CLASSES.includes(cls)) throw new Error('Invalid Class.');
  if (!Array.isArray(incomingRows)) throw new Error('Rows array is required.');

  const otherStudents = (await allStudents()).filter((s) => s._classFile !== cls);
  const otherAdmissions = new Set(otherStudents.map((s) => normId(s['Admission No'])));
  const seenInBatch = new Set();
  const cleaned = [];

  for (const r of incomingRows) {
    const adm = normId(r['Admission No'] || r.admissionNo);
    const name = String(r.Name || r.name || '').trim();
    if (!adm || !name) throw new Error('Every student row must have an Admission No and Name.');
    if (seenInBatch.has(adm) || otherAdmissions.has(adm)) {
      const err = new Error(`The Admission number "${adm}" is already existing in data!`);
      err.code = 'DUPLICATE_ADMISSION';
      throw err;
    }
    seenInBatch.add(adm);
    const rawDob = String(r['Date of Birth'] || r.dob || '01-01-2012').trim();
    cleaned.push({
      'Admission No': adm,
      Name: name,
      Class: cls,
      Section: String(r.Section || r.section || 'A').trim(),
      'Roll No': String(r['Roll No'] || r.rollNo || '').trim(),
      'Date of Birth': prettyDob(rawDob) || rawDob,
      Gender: String(r.Gender || r.gender || '').trim(),
      'Blood Group': String(r['Blood Group'] || r.bloodGroup || '').trim(),
      'House Group': String(r['House Group'] || r.houseGroup || '').trim(),
      'Residential Address': String(r['Residential Address'] || r.address || '').trim(),
      'PIN Code': String(r['PIN Code'] || r.pinCode || '').trim(),
      'Contact Number': String(r['Contact Number'] || r.contactNumber || '').trim(),
      "Mother's Name": String(r["Mother's Name"] || r.motherName || '').trim(),
      "Father's Name": String(r["Father's Name"] || r.fatherName || '').trim(),
      'Transport Mode': String(r['Transport Mode'] || r.transportMode || '').trim(),
      'Hosteler / Day Scholar': String(r['Hosteler / Day Scholar'] || r.scholarType || 'Day Scholar').trim(),
      Status: 'Active',
    });
  }

  await writeSheet(studentFile(cls), STUDENT_HEADERS, cleaned, cls);
  return cleaned.map(publicProfile);
}

/* ---------------------------- Teachers --------------------------- */
async function allTeachers() {
  return upgradePlainPasswords(paths.teachers, TEACHER_HEADERS);
}

async function findTeacherByUsername(username) {
  const key = normUsername(username);
  if (!key) return null;
  const matches = (await allTeachers()).filter((t) => normUsername(t.Username) === key);
  return matches.length === 1 ? matches[0] : null;
}

async function findTeacherByRegNo(regNo) {
  const key = normId(regNo);
  if (!key) return null;
  const matches = (await allTeachers()).filter((t) => normId(t['Reg No']) === key);
  return matches.length === 1 ? matches[0] : null;
}

/** Chat register numbers must be unique across ALL teachers & class teachers. */
async function isRegNoTaken(regNo, exceptUsername = '') {
  const key = normId(regNo);
  const except = normUsername(exceptUsername);
  return (await allTeachers()).some(
    (t) => normId(t['Reg No']) === key && normUsername(t.Username) !== except,
  );
}

async function addTeacher(payload, roleType = 'Teacher') {
  const regNo = normId(payload['Reg No'] || payload.regNo);
  if (!regNo) throw new Error('Chat-room Registration Number is required.');
  if (await isRegNoTaken(regNo)) {
    const err = new Error(`Chat-room Registration Number "${regNo}" is already registered to another teacher!`);
    err.code = 'DUPLICATE_REG_NO';
    throw err;
  }
  const name = String(payload.Name || payload.name || '').trim();
  if (!name) throw new Error('Teacher Name is required.');

  const rawUsername =
    payload.Username ||
    payload.username ||
    `${roleType === 'Class Teacher' ? 'ct' : 't'}.${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${regNo.toLowerCase()}`;
  const username = normUsername(rawUsername);
  if (!username) throw new Error('Valid Username is required.');
  if (await findTeacherByUsername(username)) {
    const err = new Error(`Username "${username}" is already taken.`);
    err.code = 'DUPLICATE_USERNAME';
    throw err;
  }
  const rawPassword = String(payload.Password || payload.password || `Teacher@${regNo}`);
  const hashedPassword = await hashPassword(rawPassword);

  const row = {
    'Reg No': regNo,
    Username: username,
    Password: hashedPassword,
    Role: roleType === 'Class Teacher' ? 'Class Teacher' : 'Teacher',
    Name: name,
    'Date of Birth': prettyDob(String(payload['Date of Birth'] || payload.dob || '')) || String(payload['Date of Birth'] || payload.dob || '').trim(),
    Gender: String(payload.Gender || payload.gender || '').trim(),
    Email: String(payload.Email || payload.email || '').trim(),
    'Phone No': String(payload['Phone No'] || payload.phone || '').trim(),
    'Residential Address': String(payload['Residential Address'] || payload.address || '').trim(),
    'PIN Code': String(payload['PIN Code'] || payload.pinCode || '').trim(),
    'Blood Group': String(payload['Blood Group'] || payload.bloodGroup || '').trim(),
    'Date of Joining': String(payload['Date of Joining'] || payload.dateOfJoining || '').trim(),
    'Educational Qualification': String(payload['Educational Qualification'] || payload.qualification || '').trim(),
    'Subject / Department': String(payload['Subject / Department'] || payload.subject || '').trim(),
    'Class Teacher Of': roleType === 'Class Teacher' ? String(payload['Class Teacher Of'] || payload.classTeacherOf || '').trim() : '',
    Status: 'Active',
  };

  const rows = await allTeachers();
  await writeSheet(paths.teachers, TEACHER_HEADERS, [...rows, row], 'Teachers');

  fs.mkdirSync(paths.teacherPhotos, { recursive: true });
  const picPath = path.join(paths.teacherPhotos, `${regNo}.svg`);
  if (!fs.existsSync(picPath)) {
    fs.writeFileSync(picPath, makeAvatarSvg(initialsOf(name), '#0f2557'));
  }

  return {
    teacher: publicProfile(row),
    credentials: { username, password: rawPassword, regNo },
  };
}

async function updateTeacher(originalRegNo, payload) {
  const origId = normId(originalRegNo);
  const rows = await allTeachers();
  const existing = rows.find((t) => normId(t['Reg No']) === origId);
  if (!existing) {
    const err = new Error('Teacher not found.');
    err.status = 404;
    throw err;
  }
  const newRegNo = normId(payload['Reg No'] ?? payload.regNo ?? existing['Reg No']);
  if (!newRegNo) throw new Error('Chat-room Registration Number is required.');
  if (newRegNo !== origId && (await isRegNoTaken(newRegNo, existing.Username))) {
    const err = new Error(`Chat-room Registration Number "${newRegNo}" is already used by another teacher!`);
    err.code = 'DUPLICATE_REG_NO';
    throw err;
  }
  const nextUsername = normUsername(payload.Username ?? payload.username ?? existing.Username);
  if (!nextUsername) throw new Error('Username is required.');
  const otherWithUser = rows.find(
    (t) => normId(t['Reg No']) !== origId && normUsername(t.Username) === nextUsername,
  );
  if (otherWithUser) throw new Error(`Username "${nextUsername}" is already used by another teacher.`);

  let nextPassword = existing.Password;
  if (payload.Password || payload.password) {
    nextPassword = await hashPassword(String(payload.Password || payload.password));
  }

  const nextRole =
    String(payload.Role ?? payload.role ?? existing.Role).trim() === 'Class Teacher'
      ? 'Class Teacher'
      : 'Teacher';

  const updated = {
    'Reg No': newRegNo,
    Username: nextUsername,
    Password: nextPassword,
    Role: nextRole,
    Name: String(payload.Name ?? payload.name ?? existing.Name).trim(),
    'Date of Birth': String(payload['Date of Birth'] ?? payload.dob ?? existing['Date of Birth']).trim(),
    Gender: String(payload.Gender ?? payload.gender ?? existing.Gender).trim(),
    Email: String(payload.Email ?? payload.email ?? existing.Email).trim(),
    'Phone No': String(payload['Phone No'] ?? payload.phone ?? existing['Phone No']).trim(),
    'Residential Address': String(payload['Residential Address'] ?? payload.address ?? existing['Residential Address']).trim(),
    'PIN Code': String(payload['PIN Code'] ?? payload.pinCode ?? existing['PIN Code']).trim(),
    'Blood Group': String(payload['Blood Group'] ?? payload.bloodGroup ?? existing['Blood Group']).trim(),
    'Date of Joining': String(payload['Date of Joining'] ?? payload.dateOfJoining ?? existing['Date of Joining']).trim(),
    'Educational Qualification': String(payload['Educational Qualification'] ?? payload.qualification ?? existing['Educational Qualification']).trim(),
    'Subject / Department': String(payload['Subject / Department'] ?? payload.subject ?? existing['Subject / Department']).trim(),
    'Class Teacher Of': nextRole === 'Class Teacher' ? String(payload['Class Teacher Of'] ?? payload.classTeacherOf ?? existing['Class Teacher Of']).trim() : '',
    Status: 'Active',
  };

  const nextRows = rows.map((t) => (normId(t['Reg No']) === origId ? updated : t));
  await writeSheet(paths.teachers, TEACHER_HEADERS, nextRows, 'Teachers');

  if (newRegNo !== origId) {
    const oldPic = path.join(paths.teacherPhotos, `${origId}.svg`);
    const newPic = path.join(paths.teacherPhotos, `${newRegNo}.svg`);
    if (fs.existsSync(oldPic) && !fs.existsSync(newPic)) {
      try { fs.renameSync(oldPic, newPic); } catch {}
    }
  }

  return {
    oldRegNo: origId,
    newRegNo,
    teacher: publicProfile(updated),
  };
}

async function deleteTeacher(regNo) {
  const key = normId(regNo);
  const rows = await allTeachers();
  const nextRows = rows.filter((t) => normId(t['Reg No']) !== key);
  if (nextRows.length === rows.length) return false;
  await writeSheet(paths.teachers, TEACHER_HEADERS, nextRows, 'Teachers');
  return true;
}

/* --------------------------- Principal / Administrative ---------- */
async function allStaff() {
  return upgradePlainPasswords(paths.staff, STAFF_HEADERS);
}

async function findStaffByUsername(username) {
  const key = normUsername(username);
  if (!key) return null;
  const matches = (await allStaff()).filter((s) => normUsername(s.Username) === key);
  return matches.length === 1 ? matches[0] : null;
}

/* ---------------------------- Admin ------------------------------ */
async function findAdminByUsername(username) {
  const key = normUsername(username);
  if (!key) return null;
  const rows = await upgradePlainPasswords(paths.admin, ADMIN_HEADERS);
  const matches = rows.filter((a) => normUsername(a.Username) === key);
  return matches.length === 1 ? matches[0] : null;
}

/** Strips secrets / internal fields before anything is sent to a browser. */
function publicProfile(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (k === 'Password' || k === 'Status' || k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}

module.exports = {
  STUDENT_HEADERS,
  TEACHER_HEADERS,
  STAFF_HEADERS,
  ADMIN_HEADERS,
  normId,
  normUsername,
  isActive,
  studentFile,
  allStudents,
  studentsByClass,
  findStudentByAdmission,
  isAdmissionTaken,
  addStudent,
  updateStudent,
  deleteStudent,
  replaceClassStudents,
  allTeachers,
  findTeacherByUsername,
  findTeacherByRegNo,
  isRegNoTaken,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  allStaff,
  findStaffByUsername,
  findAdminByUsername,
  publicProfile,
};
