#!/bin/sh
# รอฐานข้อมูลพร้อม แล้วค่อยอัปเดต schema ก่อนสตาร์ทแอป
#
# compose ตั้ง depends_on: service_healthy ไว้แล้ว แต่ healthcheck ของ MySQL
# ผ่านตั้งแต่ตอนที่ยังรับ connection ได้ไม่เต็มที่ — retry ตรงนี้กันพลาดอีกชั้น
set -e

echo "==> รอฐานข้อมูล..."
i=1
while [ "$i" -le 30 ]; do
  if npx prisma migrate status >/dev/null 2>&1; then
    break
  fi
  # migrate status คืน exit code ไม่เป็นศูนย์ตอนมี migration ค้างด้วย
  # ไม่ใช่แค่ตอนต่อ DB ไม่ได้ — จึงเช็คซ้ำว่าต่อติดหรือยังด้วย db execute
  if echo "SELECT 1;" | npx prisma db execute --stdin >/dev/null 2>&1; then
    break
  fi
  echo "    ยังไม่พร้อม ($i/30)"
  i=$((i + 1))
  sleep 2
done

echo "==> รัน migration"
npx prisma migrate deploy

echo "==> สตาร์ทแอป"
exec "$@"
