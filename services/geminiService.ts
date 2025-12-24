
import { GoogleGenAI, Type } from "@google/genai";
import { ReferenceFile, Grade, Language, Question, AnalysisResult } from "../types.ts";

const getApiKey = () => {
  return process.env.API_KEY || (window as any).process?.env?.API_KEY;
};

async function callGemini<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING: ไม่พบ API Key กรุณากดปุ่มเชื่อมต่อ");
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    return await fn(ai);
  } catch (error: any) {
    // ส่ง Error กลับไปให้ App.tsx จัดการ UI
    throw error;
  }
}

export async function generateExamFromFile(
  files: ReferenceFile[],
  grade: Grade,
  language: Language,
  count: number,
  weakTopics?: string[]
): Promise<Question[]> {
  const fileParts = files.map(f => ({
    inlineData: {
      data: f.data.split(',')[1] || f.data,
      mimeType: f.mimeType
    }
  }));

  const targetingPrompt = weakTopics && weakTopics.length > 0 
    ? `FOCUS AREAS: ${weakTopics.join(', ')}`
    : "Generate realistic exam questions based on the attached files.";

  const prompt = `Act as an expert Thai curriculum educator for Grade ${grade}.
  Task: ${targetingPrompt}
  Output Language: ${language}
  Total Questions: ${count}
  Requirements: Analyze files, 4 options, Thai explanation, Return JSON Array.`;

  return callGemini(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [...fileParts, { text: prompt }]
      },
      config: {
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

    const text = response.text || "[]";
    return JSON.parse(text).map((q: any, i: number) => ({ ...q, id: `q-${Date.now()}-${i}` }));
  });
}

export async function analyzeExamResults(
  questions: Question[], 
  userAnswers: (number | null)[]
): Promise<AnalysisResult> {
  const history = questions.map((q, i) => ({
    topic: q.topic,
    correct: q.correctIndex === userAnswers[i]
  }));

  const prompt = `Analyze this performance: ${JSON.stringify(history)}. Return JSON with summary (Thai), strengths (array), weaknesses (array), readingAdvice (Thai).`;

  return callGemini(async (ai) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            readingAdvice: { type: Type.STRING }
          },
          required: ["summary", "strengths", "weaknesses", "readingAdvice"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}
