
import { GoogleGenAI, Type } from "@google/genai";
import { ReferenceFile, Grade, Language, Question, AnalysisResult } from "../types.ts";

export async function generateExamFromFile(
  files: ReferenceFile[],
  grade: Grade,
  language: Language,
  count: number,
  weakTopics?: string[]
): Promise<Question[]> {
  // สร้าง Instance ใหม่ทุกครั้งตามคำแนะนำเพื่อป้องกันปัญหา Key ไม่อัปเดต
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
}

export async function analyzeExamResults(
  questions: Question[], 
  userAnswers: (number | null)[]
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const history = questions.map((q, i) => ({
    topic: q.topic,
    correct: q.correctIndex === userAnswers[i]
  }));

  const prompt = `Analyze this performance: ${JSON.stringify(history)}. Return JSON with summary (Thai), strengths (array), weaknesses (array), readingAdvice (Thai).`;

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
}
