
import { GoogleGenAI, Type } from "@google/genai";
import { ReferenceFile, Grade, Language, Question, AnalysisResult } from "../types.ts";

export async function generateExamFromFile(
  files: ReferenceFile[],
  grade: Grade,
  language: Language,
  count: number,
  weakTopics?: string[]
): Promise<Question[]> {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("AUTH_REQUIRED: กรุณาเชื่อมต่อ API Key ก่อนเริ่มใช้งาน");
  }

  const ai = new GoogleGenAI({ apiKey });

  const contentParts: any[] = files.map(f => ({
    inlineData: {
      data: f.data.split(',')[1] || f.data,
      mimeType: f.mimeType
    }
  }));

  const systemInstruction = `คุณคือ AI ติวเตอร์ระดับโลกที่มีความเชี่ยวชาญในการออกข้อสอบ วิเคราะห์เนื้อหาจากเอกสารที่แนบมาและสร้างข้อสอบปรนัย 4 ตัวเลือกที่ตรงจุดที่สุด`;

  const userPrompt = `สร้างข้อสอบจำนวน ${count} ข้อ สำหรับชั้น ${grade} ภาษา ${language === 'Thai' ? 'ไทย' : 'อังกฤษ'}
วิเคราะห์จากไฟล์ที่แนบมานี้
${weakTopics ? `เน้นหัวข้อเหล่านี้เป็นพิเศษ: ${weakTopics.join(', ')}` : ''}

รูปแบบคำตอบ: JSON Array ของ Object ที่มี properties: text, options (array 4 ตัว), correctIndex (0-3), explanation, topic`;

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
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              topic: { type: Type.STRING }
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
    if (e.message?.includes("not found")) {
      throw new Error("AUTH_REQUIRED: API Key ของคุณไม่สามารถเข้าถึงโมเดลนี้ได้ กรุณาใช้ Key จากโปรเจกต์ที่มีการตั้งค่า Billing หรือใช้งานใน AI Studio");
    }
    throw new Error("ไม่สามารถสร้างข้อสอบได้ในขณะนี้ กรุณาลองใหม่");
  }
}

export async function analyzeExamResults(
  questions: Question[], 
  userAnswers: (number | null)[]
): Promise<AnalysisResult> {
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });

  const history = questions.map((q, i) => ({
    topic: q.topic,
    correct: q.correctIndex === userAnswers[i]
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ parts: [{ text: `วิเคราะห์ผลสอบและแนะนำการเรียนต่อ: ${JSON.stringify(history)}` }] }],
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
}
