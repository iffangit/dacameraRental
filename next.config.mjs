/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  /**
   * บอก Turbopack ว่า root ของโปรเจกต์อยู่ที่ไหน
   *
   * ปกติ Turbopack เดาเองจากตำแหน่งของ lockfile แต่เครื่องนี้มี
   * package-lock.json หลงอยู่ที่ /Users/macbookairiffan ทำให้มันเดา root
   * ขึ้นไปหนึ่งชั้น พอ root ผิด path ของไฟล์ที่ใช้สร้าง stack trace ก็ผิดตาม
   * (ยิ่งชื่อโฟลเดอร์มีช่องว่างยิ่งพังง่าย) จนตัวถอด stack ฝั่งเบราว์เซอร์
   * พ่น "frame.join is not a function" แล้วลาม RSC payload พังทั้งก้อน
   */
  turbopack: {
    root: import.meta.dirname,
  },

  /**
   * แยกโฟลเดอร์ output ของ `next build` ออกจาก `next dev`
   *
   * ปกติทั้งสองคำสั่งเขียนลง .next เหมือนกัน ถ้าเผลอรัน build ระหว่างที่
   * dev server ทำงานอยู่ ไฟล์ที่เบราว์เซอร์โหลดไปแล้วกับที่ server มีจะคนละชุด
   * ทำให้ RSC payload อ่านไม่ออก แล้วพ่น error ที่ดูเหมือนบั๊กของ React
   * (chunk.reason.enqueueModel is not a function / Failed to fetch RSC payload)
   * ทั้งที่โค้ดไม่ได้ผิดอะไร
   *
   * package.json จึงตั้ง NEXT_DIST_DIR=.next-build ให้เฉพาะคำสั่ง build/start
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
