/**
 * ตัวเชื่อม Gemini API — REQ-AI-001 / REQ-AI-002
 *
 * เรียก REST ตรง ๆ ด้วย fetch แทนการลง SDK เพราะใช้แค่ generateContent
 * เอนด์พอยต์เดียว การเพิ่ม dependency มาห่ออีกชั้นไม่คุ้ม
 *
 * บังคับให้โมเดลตอบเป็น JSON ตาม schema (responseSchema) จะได้ไม่ต้อง
 * เดาว่าคำตอบมาในรูปแบบไหน — สำคัญมากเพราะเราเอาไปลงฐานข้อมูลโดยตรง
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * ใช้ alias "-latest" แทนการตรึงเลขเวอร์ชัน เพราะ Google ปิดโมเดลรุ่นเก่า
 * ไม่ให้ผู้ใช้ใหม่เรียกเป็นระยะ (gemini-2.5-flash ถูกปิดไปแล้วทั้งที่ยัง
 * โผล่ในรายการ ListModels) alias จะชี้ไปรุ่นที่ยังเปิดให้ใช้เสมอ
 * ถ้าต้องการตรึงเวอร์ชันให้ตั้ง GEMINI_MODEL ใน .env
 */
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
  }
}

/**
 * เรียกโมเดลแล้วคืนผลเป็น object ตาม schema ที่กำหนด
 *
 * ลองใหม่อัตโนมัติเมื่อเจอ 503 (โมเดลคนใช้เยอะ) หรือเน็ตสะดุด
 * ซึ่งเป็นอาการชั่วคราวที่เจอบ่อยมากกับ Gemini — ถ้าโยน error ทันที
 * แอดมินจะเห็นข้อความล้มเหลวทั้งที่กดใหม่อีกครั้งก็ผ่าน
 */
export async function generateJson(options) {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await callGemini(options);
    } catch (error) {
      lastError = error;
      const retryable = ["OVERLOADED", "NETWORK", "TIMEOUT", "BAD_JSON"].includes(
        error?.code,
      );
      if (!retryable || attempt === maxAttempts) throw error;

      // หน่วงแบบเพิ่มขึ้นทีละรอบ 1s → 2s
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError;
}

async function callGemini({
  prompt,
  schema,
  systemInstruction,
  model = DEFAULT_MODEL,
  temperature = 0.9,
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new GeminiError(
      "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในไฟล์ .env",
      "NO_API_KEY",
    );
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
      // งานเขียนแคปชั่นไม่ควรค้างนาน ถ้าเกินนี้ถือว่าเรียกไม่สำเร็จ
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new GeminiError("Gemini ตอบช้าเกิน 45 วินาที — ลองใหม่อีกครั้ง", "TIMEOUT");
    }
    throw new GeminiError(
      `เชื่อมต่อ Gemini ไม่ได้: ${error?.message ?? "ไม่ทราบสาเหตุ"}`,
      "NETWORK",
    );
  }

  if (!response.ok) {
    const body = await response.text();
    let detail = body.slice(0, 300);
    try {
      detail = JSON.parse(body)?.error?.message ?? detail;
    } catch {
      // ตอบกลับไม่ใช่ JSON — ใช้ข้อความดิบที่ตัดแล้ว
    }

    // 429 = เกินโควตา เป็นกรณีที่เจอบ่อยสุดตอนใช้ key ฟรี จึงแยกข้อความให้ชัด
    if (response.status === 429) {
      throw new GeminiError(
        "เกินโควตาการเรียก Gemini ชั่วคราว — รอสักครู่แล้วลองใหม่",
        "RATE_LIMIT",
      );
    }

    // 503 = โมเดลคนใช้เยอะชั่วคราว ลองใหม่ได้
    if (response.status === 503) {
      throw new GeminiError(
        "Gemini มีผู้ใช้งานหนาแน่นชั่วคราว — ลองใหม่อีกครั้ง",
        "OVERLOADED",
      );
    }
    throw new GeminiError(
      `Gemini ตอบกลับผิดพลาด (${response.status}): ${detail}`,
      "API_ERROR",
    );
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];

  if (!candidate) {
    const blocked = data?.promptFeedback?.blockReason;
    throw new GeminiError(
      blocked
        ? `Gemini ปฏิเสธคำขอนี้ (${blocked})`
        : "Gemini ไม่ได้ส่งคำตอบกลับมา",
      "NO_CANDIDATE",
    );
  }

  const text = candidate.content?.parts?.map((p) => p.text).join("") ?? "";

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError(
      "Gemini ตอบกลับมาไม่ใช่ JSON ที่อ่านได้ — ลองสร้างใหม่อีกครั้ง",
      "BAD_JSON",
    );
  }
}

/** ตรวจว่าตั้งค่า key ไว้แล้วหรือยัง ใช้ตัดสินใจว่าจะโชว์ปุ่มให้กดไหม */
export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}
