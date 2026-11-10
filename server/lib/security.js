'use strict';
/**
 * Security primitives:
 *  - scrypt password hashing (built into Node, no third-party crypto)
 *  - constant-time comparisons
 *  - server-side session store (random, httpOnly cookie – unreadable by page JS)
 *  - per-account login lockout
 */
const crypto = require('crypto');
const { IS_PROD, COOKIE_SAMESITE } = require('../config');

/* ------------------------------------------------------------------ */
/* Password hashing                                                    */
/* ------------------------------------------------------------------ */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const HASH_PREFIX = 'scrypt$';

function scrypt(password, salt, keylen, opts) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password), salt, SCRYPT.keylen, SCRYPT);
  return `${HASH_PREFIX}${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

const isHashed = (v) => typeof v === 'string' && v.startsWith(HASH_PREFIX);

// Used when the username does not exist, so response time is identical (no user enumeration).
let dummyHash = null;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}

async function verifyPassword(password, stored) {
  const target = isHashed(stored) ? stored : await getDummyHash();
  const parts = target.split('$');
  if (parts.length !== 6) return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(String(password), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  const ok = key.length === expected.length && crypto.timingSafeEqual(key, expected);
  return ok && isHashed(stored);
}

/** Constant-time string equality (hash first so lengths always match). */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */
class SessionStore {
  /**
   * @param {{cookieName:string, idleMs:number, maxMs:number}} opts
   */
  constructor({ cookieName, idleMs, maxMs }) {
    this.cookieName = IS_PROD ? `__Host-${cookieName}` : cookieName;
    this.idleMs = idleMs;
    this.maxMs = maxMs;
    this.map = new Map(); // sha256(token) -> session   (raw token never kept in memory)
    const timer = setInterval(() => this.sweep(), 60 * 1000);
    timer.unref();
  }

  cookieOptions() {
    return {
      httpOnly: true, // page JavaScript can never read it
      secure: IS_PROD || COOKIE_SAMESITE === 'none',
      sameSite: COOKIE_SAMESITE,
      path: '/',
      maxAge: this.maxMs,
    };
  }

  uaFingerprint(req) {
    return sha256(req.get('user-agent') || '');
  }

  create(req, res, user) {
    const prev = req.cookies && req.cookies[this.cookieName];
    if (typeof prev === 'string') this.map.delete(sha256(prev));
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    this.map.set(sha256(token), {
      user: Object.freeze({ ...user }),
      created: now,
      last: now,
      ua: this.uaFingerprint(req),
    });
    res.cookie(this.cookieName, token, this.cookieOptions());
  }

  get(req) {
    const token = req.cookies && req.cookies[this.cookieName];
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const key = sha256(token);
    const s = this.map.get(key);
    if (!s) return null;
    const now = Date.now();
    if (now - s.last > this.idleMs || now - s.created > this.maxMs || s.ua !== this.uaFingerprint(req)) {
      this.map.delete(key);
      return null;
    }
    s.last = now;
    return s;
  }

  destroy(req, res) {
    const token = req.cookies && req.cookies[this.cookieName];
    if (typeof token === 'string') this.map.delete(sha256(token));
    const { maxAge, ...opts } = this.cookieOptions();
    res.clearCookie(this.cookieName, opts);
  }

  /** Force-logout a user everywhere (used when admin removes/edits an account). */
  destroyUser(uid) {
    for (const [k, s] of this.map) if (s.user.uid === uid) this.map.delete(k);
  }

  sweep() {
    const now = Date.now();
    for (const [k, s] of this.map) {
      if (now - s.last > this.idleMs || now - s.created > this.maxMs) this.map.delete(k);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Login lockout (per account + login type)                            */
/* ------------------------------------------------------------------ */
class Lockout {
  constructor({ maxFails, lockMs }) {
    this.maxFails = maxFails;
    this.lockMs = lockMs;
    this.map = new Map();
    const timer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    timer.unref();
  }

  remainingMs(key) {
    const e = this.map.get(key);
    if (!e || !e.until) return 0;
    const left = e.until - Date.now();
    if (left <= 0) {
      this.map.delete(key);
      return 0;
    }
    return left;
  }

  fail(key) {
    const e = this.map.get(key) || { count: 0, until: 0, first: Date.now() };
    e.count += 1;
    if (e.count >= this.maxFails) e.until = Date.now() + this.lockMs;
    this.map.set(key, e);
  }

  clear(key) {
    this.map.delete(key);
  }

  sweep() {
    const now = Date.now();
    for (const [k, e] of this.map) {
      if ((e.until && e.until < now) || (!e.until && now - e.first > this.lockMs)) this.map.delete(k);
    }
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  isHashed,
  safeEqual,
  sha256,
  SessionStore,
  Lockout,
};
