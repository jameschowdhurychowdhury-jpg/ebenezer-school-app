'use strict';
/**
 * Creates TEST Excel databases (students per class, teachers, principal/administrative, admin).
 *   npm run seed            -> only creates files that do not exist yet (never overwrites real data)
 *   npm run seed -- --force -> overwrite everything with fresh test data
 *
 * ⚠ Test credentials are printed below – change/delete them before going live.
 */
const fs = require('fs');
const path = require('path');
const { writeSheet } = require('../lib/excel');
const { hashPassword } = require('../lib/security');
const db = require('../lib/db');
const { CLASSES, paths } = require('../config');

const FORCE = process.argv.includes('--force');

const STUDENTS = {
  'KG 1': [
    ['101', 'Aarav Debnath', 'KG 1', 'A', '1', '14-03-2021', 'Male', 'B+', 'Faith', 'Ward No. 2, Sabroom', '799145', '9862000101', 'Rina Debnath', 'Sujit Debnath', 'School Bus', 'Day Scholar'],
    ['102', 'Riya Das', 'KG 1', 'A', '2', '22-07-2020', 'Female', 'O+', 'Hope', 'Manughat, Sabroom', '799145', '9862000102', 'Mita Das', 'Ratan Das', 'Parent Drop', 'Day Scholar'],
  ],
  'Class 5': [
    ['123', 'Ananya Saha', 'Class 5', 'A', '1', '05-08-2015', 'Female', 'A+', 'Grace', 'Baishnabpur, Sabroom', '799145', '9862000123', 'Supriya Saha', 'Amit Saha', 'School Bus', 'Day Scholar'],
    ['546', 'Rohan Tripura', 'Class 5', 'A', '2', '19-11-2014', 'Male', 'B-', 'Love', 'Jalefa, Sabroom', '799145', '9862000546', 'Lakshmi Tripura', 'Bijoy Tripura', 'Hostel', 'Hosteler'],
  ],
  'Class 10': [
    ['879', 'Priya Chakraborty', 'Class 10', 'A', '1', '02-01-2010', 'Female', 'AB+', 'Faith', 'Daluchara, Sabroom', '799145', '9862000879', 'Sima Chakraborty', 'Prabir Chakraborty', 'Bicycle', 'Day Scholar'],
    ['880', 'Arjun Reang', 'Class 10', 'B', '2', '27-06-2009', 'Male', 'O-', 'Hope', 'Ekinpur, Sabroom', '799145', '9862000880', 'Mamata Reang', 'Hari Reang', 'Hostel', 'Hosteler'],
  ],
  'Class 12': [
    ['1201', 'Sneha Majumder', 'Class 12', 'A', '1', '11-09-2007', 'Female', 'A-', 'Grace', 'Rajnagar, Sabroom', '799145', '9862001201', 'Tumpa Majumder', 'Sanjay Majumder', 'School Bus', 'Day Scholar'],
    ['1202', 'Kunal Jamatia', 'Class 12', 'A', '2', '30-04-2007', 'Male', 'B+', 'Love', 'Kalachara, Sabroom', '799145', '9862001202', 'Anita Jamatia', 'Ramesh Jamatia', 'Two Wheeler', 'Day Scholar'],
  ],
};

const TEACHERS = [
  // RegNo, Username, Password, Role, Name, DOB, Gender, Email, Phone, Address, PIN, Blood, DOJ, Qualification, Subject, ClassTeacherOf
  ['1', 't.debbarma', 'Teacher@101', 'Teacher', 'Mr. Bikash Debbarma', '12-02-1985', 'Male', 'bikash.debbarma@ebenezerschool.in', '9436000001', 'Sabroom Bazar, Sabroom', '799145', 'B+', '01-06-2012', 'M.Sc, B.Ed', 'Mathematics', ''],
  ['2', 'ct.paul', 'ClassT@102', 'Class Teacher', 'Mrs. Mary Paul', '25-09-1988', 'Female', 'mary.paul@ebenezerschool.in', '9436000002', 'Church Road, Sabroom', '799145', 'O+', '15-07-2015', 'M.A (English), B.Ed', 'English', 'Class 10 - A'],
  ['3', 't.sen', 'Teacher@103', 'Teacher', 'Ms. Rupa Sen', '03-12-1990', 'Female', 'rupa.sen@ebenezerschool.in', '9436000003', 'Thana Road, Sabroom', '799145', 'A+', '10-01-2018', 'M.Sc (Chemistry), B.Ed', 'Science', ''],
  ['4', 'ct.roy', 'ClassT@104', 'Class Teacher', 'Mr. Samuel Roy', '17-05-1983', 'Male', 'samuel.roy@ebenezerschool.in', '9436000004', 'Mission Para, Sabroom', '799145', 'AB-', '01-04-2010', 'M.A (History), B.Ed', 'Social Science', 'Class 5 - A'],
];

const STAFF = [
  ['Principal', 'principal', 'Principal@2026', 'Principal', 'Dr. Elizabeth Halam', '08-08-1972', 'Female', 'principal@ebenezerschool.in', '9436000100', 'School Campus, Sabroom', '799145', 'O+', '01-01-2005', 'Ph.D (Education)'],
  ['Administrative', 'administrative', 'Office@2026', 'Administrative', 'Mr. Joseph Kalai', '21-03-1980', 'Male', 'office@ebenezerschool.in', '9436000200', 'School Campus, Sabroom', '799145', 'B+', '01-06-2008', 'M.Com, MBA'],
];

const ADMIN = [['Unknown', 'superadmin', 'EHSS#Admin2026', 'Admin']];

const toRow = (headers, arr) => Object.fromEntries(headers.map((h, i) => [h, arr[i] ?? '']));
const exists = (f) => fs.existsSync(f);

async function main() {
  const created = [];

  for (const cls of CLASSES) {
    const file = db.studentFile(cls);
    if (exists(file) && !FORCE) continue;
    const rows = (STUDENTS[cls] || []).map((s) => toRow(db.STUDENT_HEADERS, [...s, 'Active']));
    await writeSheet(file, db.STUDENT_HEADERS, rows, cls);
    created.push(path.relative(paths.db, file));
  }

  async function withHashes(list, pwIndex) {
    return Promise.all(list.map(async (r) => { const c = [...r]; c[pwIndex] = await hashPassword(c[pwIndex]); return c; }));
  }

  if (!exists(paths.teachers) || FORCE) {
    const rows = (await withHashes(TEACHERS, 2)).map((t) => toRow(db.TEACHER_HEADERS, [...t, 'Active']));
    await writeSheet(paths.teachers, db.TEACHER_HEADERS, rows, 'Teachers');
    created.push('teachers/teachers.xlsx');
  }
  if (!exists(paths.staff) || FORCE) {
    const rows = (await withHashes(STAFF, 2)).map((s) => toRow(db.STAFF_HEADERS, [...s, 'Active']));
    await writeSheet(paths.staff, db.STAFF_HEADERS, rows, 'Staff');
    created.push('staff/staff.xlsx');
  }
  if (!exists(paths.admin) || FORCE) {
    const rows = (await withHashes(ADMIN, 2)).map((a) => toRow(db.ADMIN_HEADERS, [...a, 'Active']));
    await writeSheet(paths.admin, db.ADMIN_HEADERS, rows, 'Admin');
    created.push('admin/admin.xlsx');
  }

  console.log(created.length ? `Created:\n  - ${created.join('\n  - ')}` : 'All database files already exist (use --force to reset).');
  console.log('\nTEST LOGINS');
  console.log('  Student        : Admission No 123  / DOB 05-08-2015   (also 546, 879, 880, 101, 102, 1201, 1202)');
  TEACHERS.forEach((t) => console.log(`  ${t[3].padEnd(14)} : ${t[1].padEnd(14)} / ${t[2]}   (chat Reg No ${t[0]})`));
  STAFF.forEach((s) => console.log(`  ${s[3].padEnd(14)} : ${s[1].padEnd(14)} / ${s[2]}`));
  console.log(`  Admin Panel    : ${ADMIN[0][1]} / ${ADMIN[0][2]}   (port 4000)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
