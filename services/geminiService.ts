
import { GoogleGenAI, Type } from "@google/genai";
import { ReferenceFile, Grade, Language, Question, AnalysisResult } from "../types.ts";

// ฟังก์ชันช่วยดึง API Key ที่รองรับทุกสถานการณ์
const getApiKey = () => {
  return (typeof process !== 'undefined' && process.env.API_KEY) || "";
};

export async function generateExamFromFile(
  files: ReferenceFile[],
  grade: Grade,
  language: Language,
  count: number,
  weakTopics?: string[]
): Promise<Question[]> {
  const apiKey = getApiKey();
  
  const isKeyReady = apiKey !== "" && apiKey !== "undefined";
  
  if (!isKeyReady) {
    throw new Error("AUTH_REQUIRED: ไม่พบ API Key กรุณาตั้งค่าใน Netlify หรือเชื่อมต่อผ่าน AI Studio");
  }

  const ai = new GoogleGenAI({ apiKey });

  const contentParts: any[] = files.map(f => ({
    inlineData: {
      data: f.data.split(',')[1] || f.data,
      mimeType: f.mimeType
    }
  }));

  // เน้นย้ำให้ AI เข้าใจว่าต้องตอบคำอธิบายเป็นภาษาไทยเท่านั้น
  const systemInstruction = `คุณคือ AI ติวเตอร์คนไทยที่เชี่ยวชาญการออกข้อสอบ 
  กฎเหล็ก: 
  1. ในส่วนของ 'explanation' (คำอธิบายเฉลย) และ 'topic' (หัวข้อ) คุณต้องเขียนเป็น "ภาษาไทย" เท่านั้น 
  2. แม้ว่าข้อสอบจะเป็นวิชาภาษาอังกฤษ หรือตัวเลือกภาษาอังกฤษ แต่คำอธิบายต้องแปลเป็นไทยเพื่อให้เด็กเข้าใจง่าย
  3. ห้ามใช้ภาษาอังกฤษในส่วน explanation เด็ดขาด`;

  const userPrompt = `สร้างข้อสอบจำนวน ${count} ข้อ สำหรับชั้น ${grade}
  - ภาษาของตัวข้อสอบ (text และ options): ให้ใช้ภาษา ${language === 'Thai' ? 'ไทย' : 'อังกฤษ'}
  - ภาษาของคำอธิบายเฉลย (explanation): ต้องเป็น "ภาษาไทย" 100%
  - ภาษาของหัวข้อ (topic): ต้องเป็น "ภาษาไทย" 100%
  
  วิเคราะห์จากไฟล์ที่แนบมานี้
  ${weakTopics ? `เน้นหัวข้อเหล่านี้เป็นพิเศษ: ${weakTopics.join(', ')}` : ''}

  รูปแบบคำตอบ: JSON Array ของ Object (text, options, correctIndex, explanation, topic)`;

  contentParts.push({ text: userPrompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts: contentParts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "โจทย์ข้อสอบ" },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "ตัวเลือก 4 ตัว" },
              correctIndex: { type: Type.INTEGER, description: "ดัชนีข้อที่ถูก (0-3)" },
              explanation: { type: Type.STRING, description: "คำอธิบายเฉลย (ต้องเป็นภาษาไทยเท่านั้น)" },
              topic: { type: Type.STRING, description: "ชื่อบทเรียนหรือหัวข้อ (ต้องเป็นภาษาไทยเท่านั้น)" }
            },
            required: ["text", "options", "correctIndex", "explanation", "topic"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]").map((q: any, i: number) => ({
      ...q,
      id: `q-${Date.now()}-${i}`
    }));
  } catch (e: any) {
    console.error("Gemini Error:", e);
    if (e.message?.includes("API key")) {
      throw new Error("AUTH_REQUIRED: API Key ไม่ถูกต้อง");
    }
    throw new Error("AI ไม่สามารถสร้างข้อสอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
  }
}

export async function analyzeExamResults(
  questions: Question[], 
  userAnswers: (number | null)[]
): Promise<AnalysisResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { summary: "", strengths: [], weaknesses: [], readingAdvice: "กรุณาเชื่อมต่อ API Key เพื่อวิเคราะห์ผล" };

  const ai = new GoogleGenAI({ apiKey });

  const history = questions.map((q, i) => ({
    topic: q.topic,
    correct: q.correctIndex === userAnswers[i]
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts: [{ text: `วิเคราะห์ผลสอบและแนะนำการเรียนต่อเป็นภาษาไทยเท่านั้น: ${JSON.stringify(history)}` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            readingAdvice: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { summary: "วิเคราะห์ล้มเหลว", strengths: [], weaknesses: [], readingAdvice: "ไม่สามารถเชื่อมต่อ AI เพื่อวิเคราะห์ได้" };
  }
}
