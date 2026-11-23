#!/usr/bin/env node
/**
 * seed-demo.js — ใส่เคสตัวอย่างสำหรับ "ทดสอบระบบ" ผ่าน HTTP API
 *
 * ข้อมูลในไฟล์นี้เป็นข้อมูลสมมติทั้งหมด ชื่อขึ้นต้นด้วย "ทดสอบ" ทุกเคส
 * ห้ามแก้เป็นชื่อ/เบอร์/HN ของคนจริงเด็ดขาด — repo นี้เป็น public
 *
 * วิธีใช้
 *   # เครื่องตัวเอง
 *   BASE=http://localhost:3137 USER=admin PASS=demo1234 node tools/seed-demo.js
 *   # เว็บทดสอบบน Render
 *   BASE=https://sleep-cpap-test.onrender.com USER=admin PASS=<รหัสที่ตั้งไว้> node tools/seed-demo.js
 *
 *   ลบเคสตัวอย่างออกทั้งหมด:  ... node tools/seed-demo.js --clean
 */
'use strict';

const BASE = (process.env.BASE || 'http://localhost:3137').replace(/\/+$/, '');
const USER = process.env.USER || process.env.ADMIN_USER || 'admin';
const PASS = process.env.PASS || process.env.ADMIN_PASS || '';
const CLEAN = process.argv.includes('--clean');
const PREFIX = 'cdemo';

if (!PASS) {
  console.error('ต้องส่งรหัสผ่านมาด้วย เช่น  PASS=xxxx node tools/seed-demo.js');
  process.exit(1);
}

const d = off => new Date(Date.now() + off * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

/** คะแนน STOP-BANG 8 ข้อ (0/1) และ ESS 8 ข้อ (0-3) — สมมติให้สอดคล้องกับระยะของเคส */
const CASES = [
  {
    id: 'cdemo01', name: 'ทดสอบ ก. นอนกรน', phone: '000-000-0001', hn: 'TEST0001',
    sex: 'ชาย', dob: '2521-04-12', stage: 'callback', due: d(1),
    sb: [1, 1, 1, 1, 1, 1, 1, 0], ess: [2, 3, 2, 3, 1, 2, 1, 2],
    note: 'เคสตัวอย่าง: คะแนนเสี่ยงสูงทั้งสองชุด ใช้ดูการ์ดสรุปผลสีแดง'
  },
  {
    id: 'cdemo02', name: 'ทดสอบ ข. ง่วงกลางวัน', phone: '000-000-0002', hn: 'TEST0002',
    sex: 'หญิง', stage: 'callback', due: d(-2),
    sb: [1, 1, 0, 0, 1, 0, 0, 1], ess: [3, 3, 2, 3, 2, 3, 1, 2],
    note: 'เคสตัวอย่าง: เลยกำหนดโทรกลับ 2 วัน ใช้ดูการไฮไลต์เกินกำหนด'
  },
  {
    id: 'cdemo03', name: 'ทดสอบ ค. รอพบแพทย์', phone: '000-000-0003', hn: 'TEST0003',
    sex: 'ชาย', stage: 'assess', due: d(4),
    sb: [1, 1, 1, 0, 1, 1, 0, 1], ess: [1, 2, 1, 2, 0, 1, 1, 1],
    wt: '92', h: '170', neck: '43', waist: '104', bp: '148/92', pr: '82', rr: '18', spo2: '95', temp: '36.8',
    rights: 'บัตรทอง', note: 'เคสตัวอย่าง: กรอกสัญญาณชีพครบ ใช้ดูใบประเมินก่อนตรวจ'
  },
  {
    id: 'cdemo04', name: 'ทดสอบ ง. นัดตรวจห้อง 1', phone: '000-000-0004', hn: 'TEST0004',
    sex: 'ชาย', stage: 'sleep', due: d(6),
    sb: [1, 1, 1, 1, 0, 1, 1, 1], ess: [2, 2, 3, 2, 1, 2, 2, 1],
    wt: '104', h: '172', neck: '45', waist: '118', bp: '152/95',
    testType: 'PSG', doctor: 'นพ.ทดสอบ ระบบ', sleepDate: d(6), sleepRoom: '1',
    rights: 'ประกันสังคม', indication: 'นอนกรนดัง มีคนเห็นหยุดหายใจ BMI สูง',
    note: 'เคสตัวอย่าง: มีวันนัดและห้องตรวจ ใช้ดูปฏิทินนัด Sleep test'
  },
  {
    id: 'cdemo05', name: 'ทดสอบ จ. นัดตรวจห้อง 2', phone: '000-000-0005', hn: 'TEST0005',
    sex: 'หญิง', stage: 'sleep', due: d(6),
    sb: [1, 0, 1, 1, 1, 0, 0, 0], ess: [1, 1, 2, 1, 0, 1, 0, 1],
    testType: 'PSG', doctor: 'นพ.ทดสอบ ระบบ', sleepDate: d(6), sleepRoom: '2',
    rights: 'ข้าราชการ', note: 'เคสตัวอย่าง: วันเดียวกับ ง. คนละห้อง ใช้ดูว่าปฏิทินแสดง 2 ห้องต่อคืน'
  },
  {
    id: 'cdemo06', name: 'ทดสอบ ฉ. รอแจ้งผล', phone: '000-000-0006', hn: 'TEST0006',
    sex: 'ชาย', stage: 'result', due: d(2),
    sb: [1, 1, 1, 1, 1, 1, 1, 1], ess: [3, 3, 3, 2, 2, 3, 2, 3],
    testType: 'PSG', doctor: 'นพ.ทดสอบ ระบบ', sleepDate: d(-5), sleepRoom: '1',
    plan: 'ผล AHI สูง พิจารณาเริ่ม CPAP', note: 'เคสตัวอย่าง: ตรวจแล้วรอรับรองผล'
  },
  {
    id: 'cdemo07', name: 'ทดสอบ ช. รอรับเครื่อง', phone: '000-000-0007', hn: 'TEST0007',
    sex: 'ชาย', stage: 'device', due: d(9),
    sb: [1, 1, 1, 1, 1, 1, 0, 1], ess: [2, 2, 2, 2, 1, 2, 1, 2],
    plan: 'นัดรับเครื่องและสอนใช้', note: 'เคสตัวอย่าง: รอเครื่อง CPAP'
  },
  {
    id: 'cdemo08', name: 'ทดสอบ ซ. ติดตามการใช้', phone: '000-000-0008', hn: 'TEST0008',
    sex: 'หญิง', stage: 'follow', due: d(12),
    sb: [1, 1, 0, 1, 1, 1, 0, 1], ess: [1, 1, 1, 1, 0, 1, 0, 0],
    plan: 'ใช้เครื่องเฉลี่ย 5.2 ชม./คืน ติดตามอีก 1 เดือน',
    note: 'เคสตัวอย่าง: อยู่ระหว่างติดตาม ใช้ดูภาพรวมงานวันนี้'
  }
];

const STAGE_META = {
  callback: ['โทรกลับและนัดประเมิน', 'เจ้าหน้าที่รับนัด'],
  assess: ['ประเมินสุขภาพและพบแพทย์', 'พยาบาล / แพทย์'],
  sleep: ['ตรวจการนอนหลับ (PSG/HSAT)', 'ห้องตรวจการนอนหลับ'],
  result: ['รับรองผลและแจ้งผู้ป่วย', 'แพทย์ / พยาบาลคลินิก'],
  device: ['รับเครื่องและสอนใช้', 'พยาบาล / ผู้สอนใช้เครื่อง'],
  follow: ['โทรติดตามและทบทวนข้อมูลเครื่อง', 'พยาบาล / แพทย์']
};

let cookie = '';

async function call(path, method, bodyObj) {
  const res = await fetch(BASE + path, {
    method,
    // เซิร์ฟเวอร์กัน CSRF ด้วยการบังคับ header นี้ในทุก method ที่ไม่ใช่ GET
    headers: Object.assign({ 'content-type': 'application/json', 'x-requested-with': 'fetch' },
      cookie ? { cookie } : {}),
    body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj)
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const txt = await res.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  return { ok: res.ok, status: res.status, data };
}

(async () => {
  process.stdout.write('เชื่อมต่อ ' + BASE + ' … ');
  const lg = await call('/api/login', 'POST', { username: USER, password: PASS });
  if (!lg.ok) { console.error('\nเข้าสู่ระบบไม่สำเร็จ (' + lg.status + '): ' + JSON.stringify(lg.data)); process.exit(1); }
  console.log('เข้าสู่ระบบเป็น ' + USER + ' แล้ว');

  const existing = await call('/api/cases', 'GET');
  if (!existing.ok) { console.error('อ่านทะเบียนเคสไม่ได้: ' + existing.status); process.exit(1); }
  const demoIds = existing.data.filter(c => String(c.id).startsWith(PREFIX)).map(c => c.id);
  const realCount = existing.data.length - demoIds.length;

  if (CLEAN) {
    for (const id of demoIds) {
      const r = await call('/api/cases/' + id, 'DELETE');
      console.log((r.ok ? '  ลบแล้ว  ' : '  ลบไม่ได้ ') + id);
    }
    console.log('ลบเคสตัวอย่าง ' + demoIds.length + ' เคส · เคสอื่นในระบบ ' + realCount + ' เคส ไม่ถูกแตะ');
    return;
  }

  let add = 0, upd = 0;
  for (const c of CASES) {
    const meta = STAGE_META[c.stage] || ['', ''];
    const prev = existing.data.find(x => x.id === c.id);
    const doc = Object.assign({
      nextTask: meta[0], owner: meta[1], createdAt: d(-3),
      screening: { sb: c.sb, ess: c.ess },
      log: [{ d: d(-3), t: 'สร้างจากสคริปต์ข้อมูลตัวอย่าง (ไม่ใช่ผู้รับบริการจริง)' }]
    }, c, {
      sb: c.sb.reduce((a, v) => a + v, 0),
      ess: c.ess.reduce((a, v) => a + v, 0)
    });
    delete doc.id;
    if (prev) doc._rev = prev._rev;
    const r = await call('/api/cases/' + c.id, 'PUT', doc);
    if (r.ok) { prev ? upd++ : add++; console.log('  ' + (prev ? 'อัปเดต' : 'เพิ่ม  ') + ' ' + c.id + '  ' + c.name); }
    else console.error('  พลาด  ' + c.id + ' (' + r.status + ') ' + JSON.stringify(r.data));
  }

  console.log('\nเพิ่ม ' + add + ' · อัปเดต ' + upd + ' · เคสอื่นในระบบ ' + realCount + ' เคส ไม่ถูกแตะ');
  console.log('ลบออกทีหลังด้วย:  node tools/seed-demo.js --clean');
})().catch(e => { console.error(e); process.exit(1); });
