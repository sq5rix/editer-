import { GoogleGenAI, Type } from "@google/genai";
import { Block, ResearchSource } from "../types";

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey });

const MODEL_TEXT = "gemini-3-pro-preview"; 
const MODEL_VISION = "gemini-2.5-flash"; // gemini-2.5-flash is robust for multimodal (OCR)
const MODEL_FAST = "gemini-2.5-flash"; 

// Helper to strip Markdown code fences if present
const cleanJson = (text: string | undefined): string => {
  if (!text) return "[]";
  let cleaned = text.trim();
  // Remove markdown code blocks if they exist
  cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "");
  return cleaned.trim();
};

export const transcribeImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_VISION,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Transcribe the handwritten text in this image exactly as it appears. Preserve paragraph breaks. Do not add any conversational text." }
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
    return JSON.parse(cleanJson(response.text));
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
    return JSON.parse(cleanJson(response.text));
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
    return JSON.parse(cleanJson(response.text));
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
    return JSON.parse(cleanJson(response.text));
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
    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    console.error("Custom Rewrite Error:", error);
    return [];
  }
};

export const researchTopic = async (query: string): Promise<{ content: string; sources: ResearchSource[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Research the following topic deeply and provide a comprehensive summary suitable for an editorial writer. 
      Topic: "${query}". 
      Format the output in clear Markdown with headers. 
      Focus on facts, dates, key figures, and interesting details that could be used in a story.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    // Extract text
    const text = response.text || "No result found.";

    // Extract Grounding Metadata (Sources)
    const sources: ResearchSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({
          title: chunk.web.title,
          url: chunk.web.uri
        });
      }
    });

    // Remove duplicates based on URL
    const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values());

    return { content: text, sources: uniqueSources };

  } catch (error) {
    console.error("Research Error:", error);
    throw new Error("Failed to perform research.");
  }
};