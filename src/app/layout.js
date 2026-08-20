import { Prompt, Sarabun } from "next/font/google";
import "./globals.css";

// Prompt — หัวข้อ, ตัวเลข, ป้ายกำกับ (ตาม DESIGN.md)
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Sarabun — เนื้อหา
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata = {
  title: "ระบบแอดมิน | Smart Camera & Equipment Rental",
  description:
    "ระบบบริหารจัดการและจัดคิวเช่าอุปกรณ์การถ่ายภาพอัจฉริยะ — Yala Technical College",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="th"
      className={`${prompt.variable} ${sarabun.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
