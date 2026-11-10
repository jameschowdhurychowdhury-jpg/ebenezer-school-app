'use strict';
/**
 * Excel "database" engine.
 *  - Reads the first worksheet of an .xlsx file into plain objects (header row = keys).
 *  - Caches by file mtime/size so edits made directly in Excel are picked up live.
 *  - Writes are serialised per file (lock), atomic (tmp file + rename) and backed up first.
 *  - All cells are written as TEXT so Excel never mangles admission numbers or dates.
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const ExcelJS = require('exceljs');
const { paths } = require('../config');

const cache = new Map(); // file -> { mtimeMs, size, data }
const locks = new Map(); // file -> Promise
const MAX_BACKUPS_PER_FILE = 30;

const normHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Converts any ExcelJS cell value into a trimmed string. Dates -> DD-MM-YYYY. */
function cellToString(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return `${pad(v.getUTCDate())}-${pad(v.getUTCMonth() + 1)}-${v.getUTCFullYear()}`;
  }
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text || '').join('').trim();
    if (Object.prototype.hasOwnProperty.call(v, 'result')) return cellToString(v.result);
    if (Object.prototype.hasOwnProperty.call(v, 'text')) return cellToString(v.text);
    return '';
  }
  return String(v).trim();
}

/**
 * Reads a sheet. `schema` (array of canonical header names) lets the school type
 * headers loosely in Excel ("admission no", "Admission No.") and still match.
 */
async function readSheet(file, schema = []) {
  let st;
  try {
    st = await fsp.stat(file);
  } catch {
    return { headers: [], rows: [] };
  }
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.data;

  const canonical = new Map(schema.map((h) => [normHeader(h), h]));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const headers = [];
  const rows = [];

  if (ws) {
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      const raw = cellToString(cell.value);
      headers[col - 1] = canonical.get(normHeader(raw)) || raw;
    });
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj = {};
      let hasValue = false;
      headers.forEach((h, i) => {
        if (!h) return;
        const val = cellToString(row.getCell(i + 1).value);
        obj[h] = val;
        if (val) hasValue = true;
      });
      if (hasValue) rows.push(Object.freeze(obj));
    });
  }

  const data = Object.freeze({
    headers: Object.freeze(headers.filter(Boolean)),
    rows: Object.freeze(rows),
  });
  cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data });
  return data;
}

/** Serialises async work per file so two writes can never corrupt a workbook. */
function withLock(file, fn) {
  const prev = locks.get(file) || Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    file,
    run.catch(() => {}),
  );
  return run;
}

async function backup(file) {
  try {
    await fsp.access(file);
  } catch {
    return; // nothing to back up yet
  }
  await fsp.mkdir(paths.backups, { recursive: true });
  const base = path.basename(file, '.xlsx').replace(/[^a-zA-Z0-9_-]/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fsp.copyFile(file, path.join(paths.backups, `${base}__${stamp}.xlsx`));

  // keep only the newest N backups per file
  const all = (await fsp.readdir(paths.backups)).filter((f) => f.startsWith(`${base}__`)).sort();
  const extra = all.slice(0, Math.max(0, all.length - MAX_BACKUPS_PER_FILE));
  await Promise.all(extra.map((f) => fsp.unlink(path.join(paths.backups, f)).catch(() => {})));
}

/** Writes rows to a workbook (atomic + backup). */
function writeSheet(file, headers, rows, sheetName = 'Data') {
  return withLock(file, async () => {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await backup(file);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Ebenezer H.S. School App';
    wb.created = new Date();
    const ws = wb.addWorksheet(sheetName.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.min(45, Math.max(14, h.length + 4)),
      style: { numFmt: '@' },
    }));
    for (const r of rows) {
      const out = {};
      for (const h of headers) out[h] = r[h] === undefined || r[h] === null ? '' : String(r[h]);
      ws.addRow(out);
    }
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16337A' } };
    head.alignment = { vertical: 'middle' };
    head.height = 22;

    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await wb.xlsx.writeFile(tmp);
    await fsp.rename(tmp, file);
    cache.delete(file);
  });
}

module.exports = { readSheet, writeSheet, withLock, cellToString };
