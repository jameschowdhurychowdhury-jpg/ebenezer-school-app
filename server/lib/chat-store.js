'use strict';
/**
 * School Group — Encrypted WhatsApp-style Chat-Room Engine with Per-Message 60-Day Auto-Expiry.
 *
 * Key rules from specification:
 *  1. Chat Registration IDs:
 *     - Student        -> Admission No (e.g. "123", "546", "879")
 *     - Teacher / CT   -> Reg No       (e.g. "1", "2", "3", "4")
 *     - Principal      -> "Principal"
 *     - Administrative -> "Administrative"
 *     - Admin Panel    -> "Unknown"
 *  2. Student visibility:
 *     - By default, a Student sees ONLY one account named "Principal" and can only text "Principal"
 *       until a Class Teacher (or Principal / Admin) adds them to a specific group.
 *     - Only Admin, Principal, and Class Teacher can create groups or add members into groups.
 *  3. Per-message 60-day midnight auto-deletion:
 *     - Every message (text, image, or video) is AES-256-GCM encrypted at rest.
 *     - Every message has its own expiry timestamp at midnight (12:00 AM) after 60 days:
 *       e.g. sent on 01/10/2026 -> expires 30/11/2026 00:00:00 (12:00 AM midnight);
 *            sent on 02/10/2026 -> expires 01/12/2026 00:00:00 (12:00 AM midnight).
 *     - Expired messages and their media cache are permanently purged from the room.
 *  4. Cascading Teacher Reg No change:
 *     - If Admin changes a teacher's chat-room Reg No (e.g. 2 -> 5), their chat ID updates to 5 everywhere.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { paths } = require('../config');
const db = require('./db');

const CHAT_DIR = path.join(paths.db, 'chat');
const STORE_FILE = path.join(CHAT_DIR, 'chat-rooms.enc.json');
const KEY_FILE = path.join(CHAT_DIR, 'master.key');

function getMasterKey() {
  fs.mkdirSync(CHAT_DIR, { recursive: true });
  if (!fs.existsSync(KEY_FILE)) {
    fs.writeFileSync(KEY_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
}

function encryptPayload(plainObj) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const json = Buffer.from(JSON.stringify(plainObj), 'utf8');
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
}

function decryptPayload(blob) {
  if (!blob || !blob.iv || !blob.tag || !blob.data) return null;
  try {
    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(blob.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(blob.data, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(dec.toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Computes midnight (12:00 AM) after 60 calendar days from `sentMs`.
 * Example:
 *   01/10/2026 -> 30/11/2026 00:00:00 (midnight 12 AM)
 *   02/10/2026 -> 01/12/2026 00:00:00 (midnight 12 AM)
 */
function computeExpiryMidnight(sentMs = Date.now()) {
  const d = new Date(sentMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 60, 0, 0, 0, 0);
}

function formatDateDDMMYYYY(ms) {
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Canonical actor key: e.g. "student:123", "teacher:2", "principal:Principal", "admin:Unknown" */
function actorKey(role, chatId) {
  if (role === 'student') return `student:${String(chatId).trim().toUpperCase()}`;
  if (role === 'teacher' || role === 'classteacher') return `teacher:${String(chatId).trim().toUpperCase()}`;
  if (role === 'principal') return 'principal:Principal';
  if (role === 'administrative') return 'administrative:Administrative';
  if (role === 'admin') return 'admin:Unknown';
  return `${role}:${chatId}`;
}

function dmRoomId(keyA, keyB) {
  const sorted = [keyA, keyB].sort();
  return `dm__${sorted[0]}__${sorted[1]}`;
}

function loadRaw() {
  fs.mkdirSync(CHAT_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    const now = Date.now();
    const welcomeExp = computeExpiryMidnight(now);
    const seed = {
      groups: [
        {
          id: 'grp-class-10a',
          name: 'Class 10 - A Official Group',
          category: 'class',
          className: 'Class 10',
          createdByKey: 'teacher:2',
          createdByName: 'Mrs. Mary Paul (Class Teacher · ID 2)',
          createdAt: now - 3600 * 1000 * 6,
          members: ['teacher:2', 'principal:Principal', 'student:879'],
        },
        {
          id: 'grp-staff-room',
          name: 'Teachers & Faculty Room',
          category: 'staff',
          className: '',
          createdByKey: 'principal:Principal',
          createdByName: 'Dr. Elizabeth Halam (Principal)',
          createdAt: now - 3600 * 1000 * 10,
          members: ['principal:Principal', 'administrative:Administrative', 'teacher:1', 'teacher:2', 'teacher:3', 'teacher:4'],
        },
      ],
      messages: [
        {
          id: 'msg-seed-1',
          roomId: 'grp-class-10a',
          senderKey: 'teacher:2',
          senderChatId: '2',
          senderName: 'Mrs. Mary Paul',
          senderRole: 'Class Teacher',
          sentAt: now - 3600 * 1000 * 5,
          expiresAt: welcomeExp,
          cipher: encryptPayload({
            kind: 'text',
            text: 'Welcome to Class 10 - A School Group! All messages here are AES-256 encrypted and auto-clear at midnight after 60 days.',
            mediaUrl: null,
          }),
        },
        {
          id: 'msg-seed-2',
          roomId: 'grp-staff-room',
          senderKey: 'principal:Principal',
          senderChatId: 'Principal',
          senderName: 'Dr. Elizabeth Halam',
          senderRole: 'Principal',
          sentAt: now - 3600 * 1000 * 4,
          expiresAt: welcomeExp,
          cipher: encryptPayload({
            kind: 'text',
            text: 'Good morning faculty! Please use your unique Teacher Chat Registration Number to join class groups.',
            mediaUrl: null,
          }),
        },
      ],
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function saveRaw(state) {
  fs.mkdirSync(CHAT_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

/** Purges all messages whose 60-day midnight timer has passed. */
function purgeExpired(state, now = Date.now()) {
  const before = state.messages.length;
  state.messages = state.messages.filter((m) => m.expiresAt > now);
  return state.messages.length !== before;
}

/** Resolves any participant key ("student:123", "teacher:2", "principal:Principal", etc.) to live display info. */
async function resolveDirectory() {
  const [students, teachers, staff] = await Promise.all([
    db.allStudents(),
    db.allTeachers(),
    db.allStaff(),
  ]);
  const map = new Map();

  map.set('principal:Principal', {
    key: 'principal:Principal',
    chatId: 'Principal',
    name: (staff.find((s) => String(s.Role).toLowerCase() === 'principal') || {}).Name || 'Principal',
    role: 'Principal',
    subtitle: 'Chat ID: Principal',
  });
  map.set('administrative:Administrative', {
    key: 'administrative:Administrative',
    chatId: 'Administrative',
    name: (staff.find((s) => String(s.Role).toLowerCase() === 'administrative') || {}).Name || 'Administrative',
    role: 'Administrative',
    subtitle: 'Chat ID: Administrative',
  });
  map.set('admin:Unknown', {
    key: 'admin:Unknown',
    chatId: 'Unknown',
    name: 'Unknown (Admin)',
    role: 'Admin',
    subtitle: 'Chat ID: Unknown',
  });

  for (const t of teachers) {
    if (!db.isActive(t)) continue;
    const id = db.normId(t['Reg No']);
    if (!id) continue;
    const k = `teacher:${id}`;
    map.set(k, {
      key: k,
      chatId: id,
      name: t.Name,
      role: t.Role || 'Teacher',
      classTeacherOf: t['Class Teacher Of'] || '',
      subject: t['Subject / Department'] || '',
      subtitle: `${t.Role} · Reg No: ${id}${t['Class Teacher Of'] ? ` (${t['Class Teacher Of']})` : ''}`,
    });
  }

  for (const s of students) {
    if (!db.isActive(s)) continue;
    const id = db.normId(s['Admission No']);
    if (!id) continue;
    const k = `student:${id}`;
    map.set(k, {
      key: k,
      chatId: id,
      name: s.Name,
      role: 'Student',
      className: s.Class || s._classFile,
      section: s.Section || '',
      subtitle: `Admission No: ${id} · ${s.Class || s._classFile}${s.Section ? ` (${s.Section})` : ''}`,
    });
  }

  return map;
}

function formatMessage(m) {
  const payload = decryptPayload(m.cipher) || { kind: 'text', text: '[Encrypted message]', mediaUrl: null };
  return {
    id: m.id,
    roomId: m.roomId,
    senderKey: m.senderKey,
    senderChatId: m.senderChatId,
    senderName: m.senderName,
    senderRole: m.senderRole,
    kind: payload.kind || 'text',
    text: payload.text || '',
    mediaUrl: payload.mediaUrl || null,
    sentAt: m.sentAt,
    sentDate: formatDateDDMMYYYY(m.sentAt),
    expiresAt: m.expiresAt,
    expiresDate: `${formatDateDDMMYYYY(m.expiresAt)} 12:00 AM`,
  };
}

/**
 * Returns the complete chat overview for the current user:
 *  - Rooms they can access (default Principal DM for students + any groups they were added to)
 *  - Whether they can create groups / add students
 *  - Categorized directory (for Class Teacher / Principal / Administrative / Admin)
 */
async function getOverviewForUser(actor) {
  const state = loadRaw();
  if (purgeExpired(state)) saveRaw(state);
  const dir = await resolveDirectory();
  const myKey = actorKey(actor.role, actor.id);
  const canManageGroups = ['classteacher', 'principal', 'administrative', 'admin'].includes(actor.role);

  const rooms = [];
  const lastMsgOf = (roomId) => {
    const list = state.messages.filter((m) => m.roomId === roomId);
    if (!list.length) return null;
    const last = list[list.length - 1];
    return formatMessage(last);
  };

  if (actor.role === 'student') {
    // Rule: At first student ONLY sees one account named Principal, plus any groups a Class Teacher added them to
    const pRoomId = dmRoomId(myKey, 'principal:Principal');
    rooms.push({
      id: pRoomId,
      type: 'dm',
      name: 'Principal',
      subtitle: 'Official Principal Desk · Chat ID: Principal',
      peerKey: 'principal:Principal',
      peerChatId: 'Principal',
      encrypted: true,
      lastMessage: lastMsgOf(pRoomId),
    });

    // If Admin or a Teacher has already messaged the student directly, show that DM thread too
    const dmPrefixes = state.messages
      .filter((m) => m.roomId.startsWith('dm__') && m.roomId.split('__').includes(myKey))
      .map((m) => m.roomId);
    for (const rid of new Set(dmPrefixes)) {
      if (rid === pRoomId) continue;
      const parts = rid.split('__').slice(1);
      const otherKey = parts.find((k) => k !== myKey);
      const info = dir.get(otherKey) || { name: otherKey, chatId: otherKey, subtitle: '' };
      rooms.push({
        id: rid,
        type: 'dm',
        name: info.name,
        subtitle: info.subtitle,
        peerKey: otherKey,
        peerChatId: info.chatId,
        encrypted: true,
        lastMessage: lastMsgOf(rid),
      });
    }

    // Groups the student has been added to by a Class Teacher / Principal / Admin
    for (const g of state.groups) {
      if (g.members.includes(myKey)) {
        rooms.push({
          id: g.id,
          type: 'group',
          name: g.name,
          category: g.category || 'class',
          className: g.className || '',
          subtitle: `${g.members.length} members · Created by ${g.createdByName}`,
          memberCount: g.members.length,
          members: g.members.map((k) => dir.get(k) || { key: k, chatId: k.split(':')[1] || k, name: k }),
          encrypted: true,
          lastMessage: lastMsgOf(g.id),
        });
      }
    }
  } else if (actor.role === 'admin') {
    // Admin ("Unknown") sees ALL created groups, class groups, every student account, every teacher account
    for (const g of state.groups) {
      rooms.push({
        id: g.id,
        type: 'group',
        name: g.name,
        category: g.category || 'class',
        className: g.className || '',
        subtitle: `Group (${g.members.length} members) · Created by ${g.createdByName}`,
        memberCount: g.members.length,
        members: g.members.map((k) => dir.get(k) || { key: k, chatId: k.split(':')[1] || k, name: k }),
        encrypted: true,
        lastMessage: lastMsgOf(g.id),
      });
    }
    for (const [k, info] of dir.entries()) {
      if (k === 'admin:Unknown') continue;
      const rid = dmRoomId(myKey, k);
      rooms.push({
        id: rid,
        type: 'dm',
        category: info.role === 'Student' ? 'student' : 'teacher',
        name: `${info.name} (${info.chatId})`,
        subtitle: info.subtitle,
        peerKey: k,
        peerChatId: info.chatId,
        encrypted: true,
        lastMessage: lastMsgOf(rid),
      });
    }
  } else {
    // Teacher, Class Teacher, Principal, Administrative
    for (const g of state.groups) {
      if (g.members.includes(myKey) || actor.role === 'principal' || actor.role === 'administrative') {
        rooms.push({
          id: g.id,
          type: 'group',
          name: g.name,
          category: g.category || 'class',
          className: g.className || '',
          subtitle: `${g.members.length} members · Created by ${g.createdByName}`,
          memberCount: g.members.length,
          members: g.members.map((k) => dir.get(k) || { key: k, chatId: k.split(':')[1] || k, name: k }),
          encrypted: true,
          lastMessage: lastMsgOf(g.id),
        });
      }
    }
    // Always allow direct chat with Principal, Administrative, fellow Teachers, and any existing DM threads
    const visiblePeers = new Set(['principal:Principal', 'administrative:Administrative']);
    for (const [k, info] of dir.entries()) {
      if (info.role !== 'Student' && k !== 'admin:Unknown' && k !== myKey) visiblePeers.add(k);
      if (canManageGroups && info.role === 'Student') visiblePeers.add(k);
    }
    for (const m of state.messages) {
      if (m.roomId.startsWith('dm__') && m.roomId.split('__').includes(myKey)) {
        const other = m.roomId.split('__').slice(1).find((k) => k !== myKey);
        if (other) visiblePeers.add(other);
      }
    }
    for (const k of visiblePeers) {
      if (k === myKey) continue;
      const info = dir.get(k);
      if (!info) continue;
      const rid = dmRoomId(myKey, k);
      rooms.push({
        id: rid,
        type: 'dm',
        category: info.role === 'Student' ? 'student' : 'teacher',
        name: info.name,
        subtitle: info.subtitle,
        peerKey: k,
        peerChatId: info.chatId,
        encrypted: true,
        lastMessage: lastMsgOf(rid),
      });
    }
  }

  // Directory for adding members to groups (only given to roles that can manage groups)
  const directory = canManageGroups
    ? Array.from(dir.values()).filter((d) => d.key !== 'admin:Unknown')
    : [];

  return {
    me: {
      key: myKey,
      chatId: actor.id,
      name: actor.name,
      role: actor.role,
      canManageGroups,
    },
    retentionDays: 60,
    rooms,
    directory,
  };
}

function canAccessRoom(state, actor, roomId) {
  const myKey = actorKey(actor.role, actor.id);
  if (actor.role === 'admin' || actor.role === 'principal' || actor.role === 'administrative') return true;
  if (roomId.startsWith('dm__')) {
    const parts = roomId.split('__').slice(1);
    if (!parts.includes(myKey)) return false;
    if (actor.role === 'student') {
      // Student can DM Principal anytime, or reply to a DM where a teacher/admin already messaged them
      if (parts.includes('principal:Principal')) return true;
      return state.messages.some((m) => m.roomId === roomId);
    }
    return true;
  }
  const grp = state.groups.find((g) => g.id === roomId);
  return !!grp && grp.members.includes(myKey);
}

async function getRoomMessages(actor, roomId) {
  const state = loadRaw();
  if (purgeExpired(state)) saveRaw(state);
  if (!canAccessRoom(state, actor, roomId)) {
    const err = new Error('You do not have access to this chat room.');
    err.status = 403;
    throw err;
  }
  return state.messages
    .filter((m) => m.roomId === roomId)
    .sort((a, b) => a.sentAt - b.sentAt)
    .map(formatMessage);
}

async function sendMessage(actor, { roomId, text, kind = 'text', mediaUrl = null, sentAtOverride = null }) {
  const state = loadRaw();
  purgeExpired(state);
  if (!canAccessRoom(state, actor, roomId)) {
    const err = new Error('You are not allowed to send messages in this chat room.');
    err.status = 403;
    throw err;
  }
  const cleanText = String(text || '').trim().slice(0, 2000);
  const cleanMedia = mediaUrl ? String(mediaUrl).slice(0, 350000) : null;
  if (!cleanText && !cleanMedia) {
    const err = new Error('Message cannot be empty.');
    err.status = 400;
    throw err;
  }
  const safeKind = ['text', 'image', 'video'].includes(kind) ? kind : 'text';
  const sentAt = sentAtOverride && Number.isFinite(Number(sentAtOverride)) ? Number(sentAtOverride) : Date.now();
  const expiresAt = computeExpiryMidnight(sentAt);
  const myKey = actorKey(actor.role, actor.id);

  const msg = {
    id: `msg-${crypto.randomBytes(8).toString('hex')}`,
    roomId,
    senderKey: myKey,
    senderChatId: String(actor.id),
    senderName: actor.role === 'admin' ? 'Unknown' : actor.name,
    senderRole: actor.roleLabel || actor.role,
    sentAt,
    expiresAt,
    cipher: encryptPayload({
      kind: safeKind,
      text: cleanText,
      mediaUrl: cleanMedia,
    }),
  };
  state.messages.push(msg);
  saveRaw(state);
  return formatMessage(msg);
}

async function createGroup(actor, { name, className = '', memberKeys = [] }) {
  if (!['classteacher', 'principal', 'administrative', 'admin'].includes(actor.role)) {
    const err = new Error('Only Admin, Principal, and Class Teacher can create groups.');
    err.status = 403;
    throw err;
  }
  const cleanName = String(name || '').trim().slice(0, 80);
  if (!cleanName) {
    const err = new Error('Please enter a group name.');
    err.status = 400;
    throw err;
  }
  const dir = await resolveDirectory();
  const myKey = actorKey(actor.role, actor.id);
  const members = new Set([myKey, 'principal:Principal']);
  for (const k of Array.isArray(memberKeys) ? memberKeys : []) {
    if (dir.has(k)) members.add(k);
  }

  const state = loadRaw();
  const grp = {
    id: `grp-${crypto.randomBytes(6).toString('hex')}`,
    name: cleanName,
    category: className ? 'class' : 'general',
    className: String(className || '').trim(),
    createdByKey: myKey,
    createdByName: actor.role === 'admin' ? 'Unknown (Admin)' : `${actor.name} (${actor.id})`,
    createdAt: Date.now(),
    members: Array.from(members),
  };
  state.groups.unshift(grp);
  saveRaw(state);
  return grp;
}

async function addMemberToGroup(actor, { groupId, memberKey, admissionOrRegNo, memberType = 'student' }) {
  if (!['classteacher', 'principal', 'administrative', 'admin'].includes(actor.role)) {
    const err = new Error('Only Admin, Principal, and Class Teacher can add members to a group.');
    err.status = 403;
    throw err;
  }
  const state = loadRaw();
  const grp = state.groups.find((g) => g.id === groupId);
  if (!grp) {
    const err = new Error('Group not found.');
    err.status = 404;
    throw err;
  }
  const dir = await resolveDirectory();
  let targetKey = memberKey;
  if (!targetKey && admissionOrRegNo) {
    const code = String(admissionOrRegNo).trim().toUpperCase();
    targetKey = memberType === 'teacher' ? `teacher:${code}` : `student:${code}`;
  }
  if (!targetKey || !dir.has(targetKey)) {
    const err = new Error('No active student or teacher found with that Registration / Admission Number.');
    err.status = 404;
    throw err;
  }
  if (!grp.members.includes(targetKey)) {
    grp.members.push(targetKey);
    saveRaw(state);
  }
  return {
    group: grp,
    added: dir.get(targetKey),
  };
}

/**
 * When Admin changes a teacher's chat-room Reg No from oldRegNo (e.g. "2") to newRegNo (e.g. "5"),
 * update their chat ID everywhere in groups, DMs, and message history!
 */
function renameTeacherChatId(oldRegNo, newRegNo) {
  const oldId = String(oldRegNo || '').trim().toUpperCase();
  const newId = String(newRegNo || '').trim().toUpperCase();
  if (!oldId || !newId || oldId === newId) return;
  const oldKey = `teacher:${oldId}`;
  const newKey = `teacher:${newId}`;
  const state = loadRaw();
  let changed = false;

  for (const g of state.groups) {
    if (g.createdByKey === oldKey) {
      g.createdByKey = newKey;
      changed = true;
    }
    const idx = g.members.indexOf(oldKey);
    if (idx !== -1) {
      g.members[idx] = newKey;
      g.members = Array.from(new Set(g.members));
      changed = true;
    }
  }
  for (const m of state.messages) {
    if (m.senderKey === oldKey) {
      m.senderKey = newKey;
      m.senderChatId = newId;
      changed = true;
    }
    if (m.roomId.startsWith('dm__') && m.roomId.split('__').includes(oldKey)) {
      const peers = m.roomId.split('__').slice(1).map((k) => (k === oldKey ? newKey : k));
      m.roomId = dmRoomId(peers[0], peers[1]);
      changed = true;
    }
  }
  if (changed) saveRaw(state);
}

module.exports = {
  computeExpiryMidnight,
  formatDateDDMMYYYY,
  actorKey,
  getOverviewForUser,
  getRoomMessages,
  sendMessage,
  createGroup,
  addMemberToGroup,
  renameTeacherChatId,
};
