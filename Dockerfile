# ============================================================
#  Dacamera Rental — production image
#
#  ใช้ debian slim ไม่ใช่ alpine เพราะ Prisma กับ musl libc
#  ยังมีปัญหาเรื่อง openssl เป็นระยะ — ขนาด image ใหญ่กว่านิดหน่อย
#  แลกกับการไม่ต้องมานั่งไล่บั๊กที่เกิดเฉพาะบน alpine
# ============================================================
FROM node:22-bookworm-slim AS base

# Prisma CLI ต้องการ openssl ไม่งั้นขึ้น warning ตอน migrate
# (node:*-slim ไม่ได้ติดตั้งมาให้)
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app


# ---- ชั้นติดตั้ง dependencies ----
# แยกออกมาเพื่อให้ Docker cache ไว้ ตราบใดที่ lockfile ไม่เปลี่ยน
# แก้โค้ดแล้ว build ใหม่จะไม่ต้อง npm ci ซ้ำ
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci


# ---- ชั้น build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prisma generate ต้องรันก่อน build เพราะโค้ดฝั่ง server import @prisma/client
RUN npx prisma generate

# next build ไม่ได้ต่อฐานข้อมูลจริง (ทุกหน้าเป็น dynamic) แต่ตอน collect page data
# มันจะ import src/lib/prisma.js ซึ่ง throw ถ้าไม่มี DATABASE_URL — ใส่ค่าหลอกไว้พอ
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
ENV NODE_ENV=production
RUN npm run build


# ---- ชั้นที่รันจริง ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_DIST_DIR=.next-build
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ไม่ใช้ output: "standalone" เพราะ file tracing ของ Next เก็บไฟล์ของ Prisma
# ไม่ครบเป็นบางที และ entrypoint ยังต้องเรียก prisma CLI ตอน migrate อยู่ดี
# จึงยกทั้ง node_modules มาเลย — image ใหญ่ขึ้นแต่ไม่มีเซอร์ไพรส์ตอน runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next-build ./.next-build
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# public/uploads ถูก mount ทับด้วย volume — ต้องให้ user ที่รันแอปเขียนได้
RUN mkdir -p public/uploads && chown -R node:node public/uploads
USER node

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "start"]
