import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 config — ใช้โดย Prisma CLI (migrate / studio / seed) เท่านั้น
 * ตอน runtime แอปต่อ DB ผ่าน driver adapter ใน src/lib/prisma.js
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "node prisma/seed.js",
  },
});
