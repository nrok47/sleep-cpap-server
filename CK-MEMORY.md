# CK-MEMORY — sleep-cpap-server (งานพี่ค้าง)

## คืออะไร
ระบบบริการตรวจการนอนหลับ (Sleep test) + ติดตาม CPAP ของโรงพยาบาล — **เจ้าของงานคือพี่ค้าง (พิมประภา)** CK ช่วยดูแลฝั่งโค้ด/git
เดิมเป็น artifact บน claude.ai (ต้องล็อกอิน claude.ai ทั้งเจ้าหน้าที่และผู้รับบริการ) → พี่ค้างให้ Claude แปลงเป็นชุดติดตั้งเองของ รพ.

## สถานะ (23 พ.ย. 69)
- ย้ายจาก `D:\Documents\sleep-cpap-server\` → `D:\ck_coding\htdocs\sleep-cpap-server`
- ขึ้น GitHub **public**: https://github.com/nrok47/sleep-cpap-server (CK เลือกเอง 23 พ.ย. 69 ทั้งที่เสนอ private)
- 🌐 **เว็บทดสอบ online: https://sleep-cpap-test.onrender.com** (Render free, blueprint `sleep-cpap-test`, region สิงคโปร์, deploy 23 พ.ย. 69)
  - `autoDeploy: true` — push ขึ้น main เมื่อไหร่ เว็บอัปเองใน ~1 นาที
  - admin user = `admin` · รหัส CK ตั้งเองในหน้า Render (Claude ไม่รู้) · CLINIC_PHONE ยังเป็น 045-000000 รอเบอร์จริง
  - 🔴 **ดิสก์ไม่ถาวร (`/tmp`)** — เคสหายทุกครั้งที่ deploy/รีสตาร์ท · หลับหลังเงียบ 15 นาที (คลิกแรกรอ ~50 วิ)
  - 🔴 **ห้ามกรอกชื่อ-เบอร์คนจริงบนเครื่องนี้** — ยังไม่มีประกาศ PDPA / backup / DPA
- พี่ค้าง (github `pimmy4156`) ถูกเชิญเป็น collaborator สิทธิ์ write แล้ว 23 พ.ย. 69 (รอกดรับ)
- รันจริงบน NB2 แล้ว (Node 24, port 3137) — หน้าสาธารณะ / หน้าเจ้าหน้าที่ / หน้าผู้ดูแล+audit log ใช้ได้ครบ

## เทคนิค
- Node.js ≥22.13 **ไม่มี dependency ภายนอก** ใช้ `node:sqlite` ที่มากับ Node → ไม่ต้อง npm install
- `server.js` (202 บรรทัด) + `public/index.html` (SPA ไฟล์เดียว ~57KB) + ตัวอย่าง nginx / systemd / .env
- หน้าเจ้าหน้าที่เข้าทางลิงก์ล่างสุดของหน้า "เจ้าหน้าที่เข้าสู่ระบบ" (ไม่มี route แยก, hash `#staff` ไม่ทำงานตรงๆ)
- รหัสผ่าน scrypt+salt, session cookie, rate limit, audit log ลง SQLite
- ครั้งแรกที่รัน ถ้าไม่มี user จะสร้าง admin แล้ว **พิมพ์รหัสผ่านออก console** — ต้องจดและเปลี่ยน

## รันดูเองบนเครื่อง
```
cd D:/ck_coding/htdocs/sleep-cpap-server
PORT=3137 ADMIN_USER=admin ADMIN_PASS=demo1234 DATA_DIR=./data node server.js
```

## Issue บน GitHub (23 พ.ย. 69)
- #1 HTTPS จริง + เทสบนเซิร์ฟเวอร์ รพ. — รอ IT
- #2 แก้เคสซ้อนทับกัน — ✅ แก้แล้ว (optimistic locking `_rev` → 409) รอพี่ค้างยืนยันค่อยปิด
- #3 PDPA + เกณฑ์แปลผล + รายการสิทธิ์ — พี่ค้าง/คลินิกตัดสิน ไม่ใช่เรื่องโค้ด (สีในการ์ดสรุปใช้เกณฑ์เดิมของระบบ แก้ 2 บรรทัดใน `sbRisk`/`essRisk` ถ้าเกณฑ์เปลี่ยน)
- #4 เชื่อม HIS — ติดสิทธิ์ API ของ IT

## UX ที่ทำเพิ่ม 23 พ.ย. 69
ไอคอน SVG 16 ตัวข้างคำถาม (**ขยับตอนเมาส์ชี้ CSS `steps(10)` = กระตุกแบบ gif 10 เฟรม ไม่ใช่ไฟล์ gif จริง ไม่มี JS · หยุดเมื่อเมาส์ออก · คีย์บอร์ด tab ก็ติดด้วย focus-within · prefers-reduced-motion ปิดหมด**) · จุดความคืบหน้า+เลื่อนข้อถัดไปเอง · การ์ดสรุปผล+CTA · ปุ่มมือถือ 56px · โหมดผู้สูงอายุ (zoom 3 ระดับ + สีเข้มชัด จำใน localStorage) · สถานะกำลังส่ง/ว่าง/skeleton · พิมพ์ใบประเมิน A4 (`printAssess`)
**ยังไม่ได้ทำ: ข้อ 5 ทะเบียนเคสฝั่งเจ้าหน้าที่ (ชิปกรอง+ไฮไลต์เกินกำหนด) · ข้อ 6 จัดธีมหน้าคนไข้+เจ้าหน้าที่ให้เป็นระบบเดียว**

## ทะเบียนเคสบน onrender ขึ้น 0 = ปกติ ไม่ใช่บั๊ก (CK ถาม 23 พ.ย. 69)
`render.yaml` ตั้ง `DATA_DIR=/tmp/sleep-cpap` → Render free ล้าง `/tmp` ทุกครั้งที่ deploy/รีสตาร์ท/ตื่นจากหลับ ไฟล์ `sleepclinic.db` หายทั้งก้อน
admin ยัง login ได้เพราะสร้างใหม่จาก env ตอนบูต แต่เคสไม่กลับมา · **เคสที่เทสไว้บน NB2 อยู่ใน `data-demo/sleepclinic.db`** (`DATA_DIR=./data-demo node server.js`)
ทางแก้ถ้าจะให้ถาวร: Persistent Disk $0.25/GB/เดือน (ชนกฎห้ามค่ารายเดือน) · Postgres free ของ Render (หมดอายุ 30 วัน + ต้องรื้อจาก node:sqlite) → **เคาะ 23 พ.ย. 69: ปล่อยไว้** เครื่องนี้เป็นแค่ที่ให้พี่ค้างคลิกดูหน้าจอ

## ทำไมเลือก Render ไม่ใช่ Vercel / Cloudflare
โค้ดนี้เป็น Node long-running + เขียนไฟล์ `node:sqlite` → Vercel serverless ไม่มี process ค้าง ไฟล์ .db หายทุก request + session/rate-limit ใน memory พัง · Cloudflare Workers ไม่ใช่ Node จริง (workerd) ไม่มี `node:sqlite` ต้องเขียน DB ใหม่เป็น D1 ทั้งไฟล์
Render รัน `node server.js` ตรงๆ = โค้ดเบสเดียวกับที่ IT รพ. จะลงด้วย systemd ไม่ต้องดูแล 2 เวอร์ชัน และเครื่องเทสสะท้อนของจริง

## บทเรียนตอนเทส
อย่าเรียก `window.print()` ผ่าน browser automation — native dialog ทำให้ Chrome ค้างทั้งหน้าต่าง ต้องให้คนกด Esc เอง → เทสจาก `printArea.innerHTML` แทน

## ค้างอยู่ / ต้องถามพี่ค้าง
- ยังไม่ได้เทส HTTPS จริง / บนเซิร์ฟเวอร์ รพ. / หลายคนพร้อมกัน (แก้เคสเดียวกัน 2 คน คนหลังทับคนแรก)
- ยังไม่เชื่อม HIS — กรอก HN มือ
- ต้องมี: ประกาศความเป็นส่วนตัว + ฐานกฎหมาย PDPA, ระยะเวลาเก็บข้อมูล, เกณฑ์แปลผลคะแนน, เบอร์คลินิกจริง (`CLINIC_PHONE`)
- 🔴 repo public แต่ `data/ *.db .env` ถูก .gitignore ไว้ — **ห้าม commit ไฟล์ฐานข้อมูลจริงเด็ดขาด** (ชื่อ+เบอร์+ข้อมูลสุขภาพรายคน)
