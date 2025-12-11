import { GoogleGenAI, Type } from "@google/genai";
import { Block } from "../types";

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey });

const MODEL_TEXT = "gemini-3-pro-preview"; // Better for complex reasoning/writing
const MODEL_VISION = "gemini-2.5-flash-image"; // Efficient for OCR
const MODEL_FAST = "gemini-2.5-flash"; // For quick grammar checks

export const transcribeImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_VISION,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Transcribe the handwritten text in this image exactly as it appears. Preserve paragraph breaks." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to recognize handwriting.");
  }
};

export const getSynonyms = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Provide 6 distinct synonyms or short phrasing variations for the word or phrase: "${text}". Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Synonym Error:", error);
    return [];
  }
};

export const expandText = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Rewrite the following text to be more descriptive, flow better, and be slightly longer. Provide 6 different variations ranging from concise to flowery. Text: "${text}". Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Expand Error:", error);
    return [];
  }
};

export const checkGrammar = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Check the grammar and style of the following text. Provide up to 6 corrected versions, ranging from strict grammatical fixes to stylistic improvements. Text: "${text}". Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Grammar Error:", error);
    return [];
  }
};

export const analyzeParagraph = async (text: string, type: 'sensory' | 'show-dont-tell'): Promise<string[]> => {
  const prompt = type === 'sensory' 
    ? `Rewrite this paragraph 4 times. Focus deeply on "Sensorizing" it—adding details of smell, touch, sound, and sight. Make it vivid.`
    : `Rewrite this paragraph 4 times applying the "Show, Don't Tell" principle. Instead of stating emotions or facts, describe the actions and environment that prove them.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `${prompt} Text: "${text}". Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Analysis Error:", error);
    return [];
  }
};

export const customRewrite = async (text: string, customPrompt: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Rewrite the following text based strictly on this instruction: "${customPrompt}". Provide 4 distinct variations. Text to rewrite: "${text}". Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Custom Rewrite Error:", error);
    return [];
  }
};