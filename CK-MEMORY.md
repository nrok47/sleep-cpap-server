# CK-MEMORY — sleep-cpap-server (งานพี่ค้าง)

## คืออะไร
ระบบบริการตรวจการนอนหลับ (Sleep test) + ติดตาม CPAP ของโรงพยาบาล — **เจ้าของงานคือพี่ค้าง (พิมประภา)** CK ช่วยดูแลฝั่งโค้ด/git
เดิมเป็น artifact บน claude.ai (ต้องล็อกอิน claude.ai ทั้งเจ้าหน้าที่และผู้รับบริการ) → พี่ค้างให้ Claude แปลงเป็นชุดติดตั้งเองของ รพ.

## สถานะ (23 พ.ย. 69)
- ย้ายจาก `D:\Documents\sleep-cpap-server\` → `D:\ck_coding\htdocs\sleep-cpap-server`
- ขึ้น GitHub **public**: https://github.com/nrok47/sleep-cpap-server (CK เลือกเอง 23 พ.ย. 69 ทั้งที่เสนอ private)
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

## ค้างอยู่ / ต้องถามพี่ค้าง
- ยังไม่ได้เทส HTTPS จริง / บนเซิร์ฟเวอร์ รพ. / หลายคนพร้อมกัน (แก้เคสเดียวกัน 2 คน คนหลังทับคนแรก)
- ยังไม่เชื่อม HIS — กรอก HN มือ
- ต้องมี: ประกาศความเป็นส่วนตัว + ฐานกฎหมาย PDPA, ระยะเวลาเก็บข้อมูล, เกณฑ์แปลผลคะแนน, เบอร์คลินิกจริง (`CLINIC_PHONE`)
- 🔴 repo public แต่ `data/ *.db .env` ถูก .gitignore ไว้ — **ห้าม commit ไฟล์ฐานข้อมูลจริงเด็ดขาด** (ชื่อ+เบอร์+ข้อมูลสุขภาพรายคน)
