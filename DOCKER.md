# ย้ายระบบไปรันบน iMac ด้วย Docker

ทำได้ และตอนนี้ตั้งค่าไว้ให้แล้ว — บน iMac ไม่ต้องลง Node, ไม่ต้องลง XAMPP,
ไม่ต้องลง MariaDB ลงแค่ Docker Desktop ตัวเดียวจบ

ระบบถูกแยกเป็นสอง container:

| container | ทำอะไร | ข้อมูลเก็บที่ไหน |
|---|---|---|
| `db` | MariaDB 11.4 | volume `dacamera_db-data` |
| `app` | Next.js production (`next start`) | รูปอัปโหลดอยู่ volume `dacamera_uploads` |

ตอน `app` สตาร์ท มันจะรอ `db` พร้อม แล้วรัน `prisma migrate deploy` ให้เองก่อนเปิดเว็บ
เพราะฉะนั้นเครื่องใหม่ไม่ต้องมานั่ง migrate เอง

---

## ครั้งแรกบน iMac

### 1. ลง Docker Desktop

https://www.docker.com/products/docker-desktop/ — เลือกให้ตรงชิป (Apple Silicon / Intel)
เปิดโปรแกรมทิ้งไว้ให้ขึ้นสถานะ running

### 2. ดึงโค้ด

```bash
git clone https://github.com/iffangit/dacameraRental.git
cd dacameraRental
```

### 3. ตั้งค่า

```bash
cp .env.docker.example .env.docker
```

แก้ `.env.docker` ให้ครบ:

- `MARIADB_ROOT_PASSWORD` — ตั้งใหม่ได้ตามใจ **ห้ามมีอักขระ `@ : / ? #`** เพราะต้องเอาไปต่อเป็น URL
- `DATABASE_URL` — รหัสผ่านกับชื่อ database ต้องตรงกับสองบรรทัดบน (host เป็น `db` ไม่ใช่ `127.0.0.1`)
- `AUTH_SECRET` — สร้างใหม่ด้วย
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
  ถ้าไม่มี node บน iMac ใช้ `openssl rand -base64 32` แทนได้
- `GEMINI_API_KEY` — คีย์เดิมจาก `.env` บนเครื่อง MacBook (หน้า marketing ถึงจะทำงาน)

> `.env.docker` ถูก gitignore ไว้ ไม่ขึ้น GitHub — ต้องสร้างเองบนทุกเครื่อง

### 4. สตาร์ท

```bash
docker compose up -d --build
```

ครั้งแรกใช้เวลา 3–5 นาที (โหลด base image + `npm ci` + `next build`)
ครั้งต่อ ๆ ไปเร็วกว่ามากเพราะ Docker cache ไว้

เปิด http://localhost:3000

### 5. ใส่ข้อมูลตั้งต้น

เลือกอย่างใดอย่างหนึ่ง

**ก. ข้อมูลตัวอย่าง (เริ่มใหม่)**

```bash
docker compose exec app npm run db:seed
```

บัญชีทดสอบ: `admin@dacamera.local` / `password123`

**ข. ย้ายข้อมูลจริงจากเครื่อง MacBook** → ดูหัวข้อถัดไป

---

## ย้ายข้อมูลจาก XAMPP เดิมมาที่ iMac

### บน MacBook (เครื่องเดิม) — dump ออกมาก่อน

เปิด MySQL ใน XAMPP ให้ทำงานอยู่ แล้ว

```bash
cd "/Users/macbookairiffan/Dacamera system"

# ฐานข้อมูล
/Applications/XAMPP/xamppfiles/bin/mariadb-dump -u root \
  --default-character-set=utf8mb4 \
  dacamera_rental > ~/Desktop/dacamera_rental.sql

# รูปที่อัปโหลด (ไม่ได้อยู่บน GitHub — ต้องก๊อปมือ)
tar -czf ~/Desktop/dacamera_uploads.tgz -C public uploads
```

ก๊อปสองไฟล์นี้ไป iMac (AirDrop / thumb drive / iCloud)

> dump มีตาราง `_prisma_migrations` ติดไปด้วย — ตั้งใจให้เป็นแบบนั้น
> Prisma จะได้รู้ว่า migration ไหนรันไปแล้ว ไม่รันซ้ำ

### บน iMac — ใส่กลับเข้า container

ทำหลังจาก `docker compose up -d` แล้ว (schema ถูกสร้างไว้แล้ว dump จะเขียนทับให้เอง)

```bash
cd dacameraRental

# 1. ฐานข้อมูล — ใส่รหัสตรงกับ MARIADB_ROOT_PASSWORD ใน .env.docker
docker compose exec -T db \
  mariadb -u root -p'รหัสผ่านของคุณ' --default-character-set=utf8mb4 dacamera_rental \
  < ~/Desktop/dacamera_rental.sql

# 2. รูปอัปโหลด
tar -xzf ~/Desktop/dacamera_uploads.tgz -C public
docker compose cp ./public/uploads/. app:/app/public/uploads/
docker compose exec -u root app chown -R node:node /app/public/uploads

# 3. รีสตาร์ทแอป
docker compose restart app
```

> เจ้าของไฟล์ต้องเป็น `node` เพราะแอปในคอนเทนเนอร์รันด้วย user นี้
> ถ้าลืม chown แอปจะอ่านรูปเก่าได้แต่เขียนรูปใหม่ทับไม่ได้

---

## คำสั่งที่ใช้บ่อย

```bash
docker compose up -d              # สตาร์ท (ใช้ image ที่ build ไว้แล้ว)
docker compose up -d --build      # สตาร์ท + build ใหม่ (ใช้ทุกครั้งที่แก้โค้ด)
docker compose logs -f app        # ดู log แอปแบบสด
docker compose ps                 # ดูสถานะ
docker compose restart app        # รีสตาร์ทเฉพาะแอป
docker compose down               # ปิด (ข้อมูลใน volume ยังอยู่)
docker compose down -v            # ปิด + ลบข้อมูลทั้งหมด ⚠️ ลบจริง
```

### อัปเดตโค้ดจาก GitHub

```bash
git pull
docker compose up -d --build
```

migration ใหม่จะถูกรันให้อัตโนมัติตอน container สตาร์ท

### แบ็กอัปฐานข้อมูล

```bash
docker compose exec -T db mariadb-dump -u root -p'รหัสผ่านของคุณ' \
  --default-character-set=utf8mb4 dacamera_rental \
  > backup-$(date +%Y%m%d).sql
```

### เข้า MySQL shell

```bash
docker compose exec db mariadb -u root -p dacamera_rental
```

หรือต่อจากโปรแกรมบนเครื่อง (TablePlus / DBeaver) ที่ `127.0.0.1:3307`
— ใช้ 3307 ไม่ใช่ 3306 เพราะกันชนกับ XAMPP ที่จอง 3306 อยู่

---

## ถ้าจะเขียนโค้ดต่อบน iMac

Next.js เองแนะนำว่าบน macOS อย่าเอา `next dev` ไปรันใน Docker เพราะ hot reload
ผ่าน bind mount ช้ามาก — compose ชุดนี้จึงตั้งไว้สำหรับรัน production เท่านั้น

วิธีที่ลื่นกว่าคือ **ใช้ container เฉพาะฐานข้อมูล แล้วรันแอปบนเครื่องตรง ๆ**

```bash
docker compose up -d db     # เปิดแค่ MariaDB
npm install
npm run dev
```

โดยตั้ง `.env` (คนละไฟล์กับ `.env.docker`) ให้ชี้มาที่พอร์ตที่ container เปิดไว้:

```
DATABASE_URL="mysql://root:รหัสผ่านของคุณ@127.0.0.1:3307/dacamera_rental"
```

แบบนี้ไม่ต้องลง XAMPP บน iMac เลย แต่ยังได้ dev server ที่เร็วเต็มที่

---

## เจอปัญหา

**`docker compose up` แล้ว app ขึ้น unhealthy / restart วน**
```bash
docker compose logs app --tail=50
```
ส่วนใหญ่คือ `DATABASE_URL` ใน `.env.docker` ไม่ตรงกับ `MARIADB_ROOT_PASSWORD`

**เปลี่ยนรหัสผ่านใน `.env.docker` แล้วต่อ DB ไม่ได้**
MariaDB ตั้งรหัสผ่านแค่ตอนสร้าง volume ครั้งแรก แก้ทีหลังไม่มีผล
ถ้าจะเปลี่ยนจริงต้อง `docker compose down -v` (⚠️ ข้อมูลหาย — แบ็กอัปก่อน) แล้ว up ใหม่

**พอร์ต 3000 ถูกใช้อยู่**
แก้ `ports` ของ service `app` ใน `docker-compose.yml` เป็น `"3001:3000"`

**รูปหายหลัง rebuild**
ไม่ควรเกิด เพราะรูปอยู่ใน volume `dacamera_uploads` ไม่ได้อยู่ใน image
ถ้าหายจริงแปลว่าเผลอรัน `docker compose down -v`
