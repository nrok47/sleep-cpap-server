// ระบบบริการตรวจการนอนหลับและติดตาม CPAP — เซิร์ฟเวอร์ (ไม่มี dependency ภายนอก)
// ต้องใช้ Node.js 22.13 ขึ้นไป (ใช้ node:sqlite ที่มากับ Node)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DATA = path.resolve(process.env.DATA_DIR || path.join(here, 'data'));
const SECURE = process.env.COOKIE_SECURE === '1';
const PROXY = process.env.TRUST_PROXY === '1';
const HOURS = +process.env.SESSION_HOURS || 12;
const CLINIC_PHONE = process.env.CLINIC_PHONE || '';
const TZ = process.env.TZ_NAME || 'Asia/Bangkok';

fs.mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'sleepclinic.db'));
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display TEXT NOT NULL, role TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(tok TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, json TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, ts TEXT NOT NULL, user TEXT NOT NULL, action TEXT NOT NULL, target TEXT, ip TEXT);
`);

const now = () => new Date().toISOString();
const today = (off = 0) => new Date(Date.now() + off * 864e5).toLocaleDateString('sv-SE', { timeZone: TZ });
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const okPw = (pw, salt, hash) => { const a = Buffer.from(hashPw(pw, salt), 'hex'), b = Buffer.from(hash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const audit = (user, action, target, ip) => db.prepare('INSERT INTO audit(ts,user,action,target,ip) VALUES(?,?,?,?,?)').run(now(), user, action, target || '', ip || '');

function addUser(username, display, role, pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users(username,display,role,salt,hash,active,created) VALUES(?,?,?,?,?,1,?)').run(username, display, role, salt, hashPw(pw, salt), now());
}
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const u = process.env.ADMIN_USER || 'admin';
  const p = process.env.ADMIN_PASS || crypto.randomBytes(9).toString('base64url');
  addUser(u, 'ผู้ดูแลระบบ', 'admin', p);
  console.log('\n=== สร้างบัญชีผู้ดูแลระบบครั้งแรก ===\nชื่อผู้ใช้: ' + u + '\nรหัสผ่าน: ' + p + '\n(จดไว้และเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ)\n');
}

// ---------- rate limit ----------
const hits = new Map();
function count(key, windowMs) { const t = Date.now(), a = (hits.get(key) || []).filter(x => t - x < windowMs); hits.set(key, a); return a.length; }
function push(key) { (hits.get(key) || (hits.set(key, []), hits.get(key))).push(Date.now()); }
setInterval(() => { const t = Date.now(); for (const [k, a] of hits) if (!a.some(x => t - x < 36e5)) hits.delete(k); db.prepare('DELETE FROM sessions WHERE expires<?').run(t); }, 36e5).unref();

// ---------- helpers ----------
const clientIp = req => PROXY && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress;
const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); };
const fail = (res, code, msg) => send(res, code, { error: msg });
function body(req, limit = 200000) {
  return new Promise((ok, no) => {
    let n = 0; const ch = [];
    req.on('data', c => { n += c.length; if (n > limit) { no(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else ch.push(c); });
    req.on('end', () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch).toString('utf8')) : {}); } catch { no(Object.assign(new Error('bad json'), { status: 400 })); } });
  });
}
function session(req) {
  const m = /(?:^|; )sid=([a-f0-9]{64})/.exec(req.headers.cookie || ''); if (!m) return null;
  const r = db.prepare('SELECT u.id,u.username,u.display,u.role,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.tok=? AND u.active=1').get(sha(m[1]));
  if (!r || r.expires < Date.now()) return null; return r;
}
const setCookie = (res, v, age) => res.setHeader('Set-Cookie', `sid=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${SECURE ? '; Secure' : ''}`);
const idOk = s => /^[A-Za-z0-9_-]{3,40}$/.test(s);
const lastList = new Map();

// ---------- API ----------
async function api(req, res, url, p, ip) {
  const method = req.method;
  if (method !== 'GET' && req.headers['x-requested-with'] !== 'fetch') return fail(res, 403, 'forbidden');
  if (p === '/api/config' && method === 'GET') return send(res, 200, { clinicPhone: CLINIC_PHONE });
  const me = session(req);
  if (p === '/api/me' && method === 'GET') return send(res, 200, me ? { staff: true, username: me.username, name: me.display, role: me.role } : { staff: false });

  if (p === '/api/login' && method === 'POST') {
    const b = await body(req, 2000), uname = String(b.username || '').trim().toLowerCase();
    const k1 = 'lf:' + ip, k2 = 'lf:' + ip + ':' + uname;
    if (count(k1, 9e5) >= 15 || count(k2, 9e5) >= 6) return fail(res, 429, 'ลองผิดหลายครั้ง กรุณารอ 15 นาที');
    const u = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(uname);
    const good = u ? okPw(String(b.password || ''), u.salt, u.hash) : (hashPw('x', 'y'), false);
    if (!good) { push(k1); push(k2); audit(uname || '-', 'เข้าสู่ระบบไม่สำเร็จ', '', ip); return fail(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); }
    const tok = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions(tok,user_id,expires) VALUES(?,?,?)').run(sha(tok), u.id, Date.now() + HOURS * 36e5);
    setCookie(res, tok, HOURS * 3600); audit(u.username, 'เข้าสู่ระบบ', '', ip);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/logout' && method === 'POST') {
    const m = /(?:^|; )sid=([a-f0-9]{64})/.exec(req.headers.cookie || '');
    if (m) db.prepare('DELETE FROM sessions WHERE tok=?').run(sha(m[1]));
    setCookie(res, '', 0); if (me) audit(me.username, 'ออกจากระบบ', '', ip); return send(res, 200, { ok: true });
  }

  // ---- ผู้รับบริการส่งคำขอ (ไม่ต้องล็อกอิน) ----
  if (p === '/api/public/submit' && method === 'POST') {
    const b = await body(req, 20000);
    if (b.website) return send(res, 200, { ok: true }); // honeypot
    if (count('pub:' + ip, 36e5) >= 10) return fail(res, 429, 'ส่งบ่อยเกินไป');
    const name = String(b.name || '').trim().replace(/\s+/g, ' ');
    const phone = String(b.phone || '').replace(/[^0-9+,\- ]/g, '').trim();
    const digits = phone.replace(/\D/g, '');
    if (name.length < 2 || name.length > 100) return fail(res, 400, 'ชื่อไม่ถูกต้อง');
    if (digits.length < 9 || digits.length > 20) return fail(res, 400, 'เบอร์โทรไม่ถูกต้อง');
    if (b.consent !== true) return fail(res, 400, 'ต้องยินยอมการใช้ข้อมูล');
    const time = ['08:00–12:00', '13:00–16:00', 'ไม่ระบุ'].includes(b.time) ? b.time : 'ไม่ระบุ';
    const okArr = (a, max) => Array.isArray(a) && a.length === 8 && a.every(v => Number.isInteger(v) && v >= 0 && v <= max);
    const sbOk = okArr(b.sb, 1), esOk = okArr(b.ess, 3);
    if (!sbOk && !esOk) return fail(res, 400, 'กรุณาทำแบบประเมินอย่างน้อยหนึ่งชุด');
    push('pub:' + ip);
    const dup = db.prepare("SELECT 1 FROM cases WHERE json_extract(json,'$.phone')=? AND json_extract(json,'$.source')='public' AND created>?").get(phone, new Date(Date.now() - 6e5).toISOString());
    if (dup) return send(res, 200, { ok: true });
    const doc = {
      uid: 'public', source: 'public', name, phone, time,
      sb: sbOk ? b.sb.reduce((a, v) => a + v, 0) : null, ess: esOk ? b.ess.reduce((a, v) => a + v, 0) : null,
      screening: { sb: sbOk ? b.sb : null, ess: esOk ? b.ess : null },
      hn: '', stage: 'callback', nextTask: 'โทรกลับและนัดประเมิน', owner: 'เจ้าหน้าที่รับนัด', due: today(2), createdAt: today(), note: '',
      log: [{ d: today(), t: 'รับคำขอจากผู้รับบริการ (หน้าสาธารณะ)' }]
    };
    const id = 'c' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    db.prepare('INSERT INTO cases(id,json,created,updated) VALUES(?,?,?,?)').run(id, JSON.stringify(doc), now(), now());
    audit('ผู้รับบริการ', 'ส่งคำขอใหม่', id, ip);
    return send(res, 200, { ok: true });
  }

  // ---- ต่อไปนี้เฉพาะเจ้าหน้าที่ ----
  if (!me) return fail(res, 401, 'unauthorized');

  if (p === '/api/cases' && method === 'GET') {
    const t = Date.now(); if (t - (lastList.get(me.username) || 0) > 6e5) { audit(me.username, 'เปิดดูทะเบียนเคส', '', ip); lastList.set(me.username, t); }
    return send(res, 200, db.prepare('SELECT id,json,updated FROM cases').all().map(r => ({ id: r.id, ...JSON.parse(r.json), _rev: r.updated })));
  }
  const cm = /^\/api\/cases\/([A-Za-z0-9_-]+)$/.exec(p);
  if (cm) {
    const id = cm[1]; if (!idOk(id)) return fail(res, 400, 'bad id');
    if (method === 'PUT' || method === 'PATCH') {
      const b = await body(req); if (!b || typeof b !== 'object' || Array.isArray(b)) return fail(res, 400, 'bad body'); delete b.id;
      const rev = b._rev; delete b._rev;
      const row = db.prepare('SELECT json,updated FROM cases WHERE id=?').get(id);
      // กันสองคนแก้เคสเดียวกันแล้วทับกัน (lost update): ต้องส่ง _rev ที่ได้ตอนโหลดเคสมาด้วย
      if (row && rev !== row.updated) return fail(res, 409, 'เคสนี้ถูกแก้ไขไปแล้วโดยผู้ใช้อื่น กรุณารีเฟรชหน้าจอแล้วแก้ใหม่');
      if (method === 'PATCH') { if (!row) return fail(res, 404, 'not found'); Object.assign(b, { ...JSON.parse(row.json), ...b }); }
      let rev2 = now(); if (row && rev2 === row.updated) rev2 = new Date(Date.parse(rev2) + 1).toISOString();
      if (row) db.prepare('UPDATE cases SET json=?,updated=? WHERE id=?').run(JSON.stringify(b), rev2, id);
      else db.prepare('INSERT INTO cases(id,json,created,updated) VALUES(?,?,?,?)').run(id, JSON.stringify(b), rev2, rev2);
      audit(me.username, row ? 'แก้ไขเคส' : 'สร้างเคส', id + ' ' + (b.name || ''), ip); return send(res, 200, { ok: true, _rev: rev2 });
    }
    if (method === 'DELETE') {
      const row = db.prepare('SELECT json FROM cases WHERE id=?').get(id);
      db.prepare('DELETE FROM cases WHERE id=?').run(id); audit(me.username, 'ลบเคส', id + ' ' + (row ? JSON.parse(row.json).name || '' : ''), ip); return send(res, 200, { ok: true });
    }
  }

  // ---- ผู้ดูแลระบบ ----
  if (me.role !== 'admin') return fail(res, 403, 'forbidden');
  if (p === '/api/users' && method === 'GET') return send(res, 200, db.prepare('SELECT id,username,display,role,active,created FROM users ORDER BY id').all());
  if (p === '/api/users' && method === 'POST') {
    const b = await body(req, 4000), u = String(b.username || '').trim().toLowerCase(), pw = String(b.password || '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(u)) return fail(res, 400, 'ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–32 ตัว');
    if (pw.length < 8) return fail(res, 400, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร');
    if (db.prepare('SELECT 1 FROM users WHERE username=?').get(u)) return fail(res, 409, 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
    addUser(u, String(b.display || u).slice(0, 60), b.role === 'admin' ? 'admin' : 'staff', pw); audit(me.username, 'เพิ่มผู้ใช้', u, ip); return send(res, 200, { ok: true });
  }
  const um = /^\/api\/users\/(\d+)$/.exec(p);
  if (um && method === 'PATCH') {
    const id = +um[1], b = await body(req, 4000), u = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!u) return fail(res, 404, 'not found');
    const role = b.role ? (b.role === 'admin' ? 'admin' : 'staff') : u.role, active = b.active === undefined ? u.active : (b.active ? 1 : 0);
    const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1 AND id<>?").get(id).n;
    if ((role !== 'admin' || !active) && admins < 1) return fail(res, 400, 'ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน');
    if (b.password !== undefined) {
      if (String(b.password).length < 8) return fail(res, 400, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร');
      const salt = crypto.randomBytes(16).toString('hex'); db.prepare('UPDATE users SET salt=?,hash=? WHERE id=?').run(salt, hashPw(String(b.password), salt), id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    }
    db.prepare('UPDATE users SET role=?,active=?,display=? WHERE id=?').run(role, active, b.display ? String(b.display).slice(0, 60) : u.display, id);
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    audit(me.username, 'แก้ไขผู้ใช้', u.username, ip); return send(res, 200, { ok: true });
  }
  if (p === '/api/audit' && method === 'GET') return send(res, 200, db.prepare('SELECT ts,user,action,target,ip FROM audit ORDER BY id DESC LIMIT 300').all());
  return fail(res, 404, 'not found');
}

// ---------- static ----------
const server = http.createServer(async (req, res) => {
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const url = new URL(req.url, 'http://x'), p = url.pathname;
    if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
    if (p.startsWith('/api/')) return await api(req, res, url, p, clientIp(req));
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(fs.readFileSync(path.join(here, 'public', 'index.html')));
    }
    res.writeHead(404); res.end('Not found');
  } catch (e) {
    if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : 'server error'); else res.end();
    if (!e.status) console.error(e);
  }
});
server.listen(PORT, HOST, () => console.log(`เปิดบริการที่ http://${HOST}:${PORT}  (ข้อมูลอยู่ที่ ${DATA})`));
