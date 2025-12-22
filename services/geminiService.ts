import { GoogleGenAI, Type } from "@google/genai";
import { ResearchSource, Character, StyleAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT = "gemini-3-pro-preview"; 
const MODEL_VISION = "gemini-3-flash-preview"; 
const MODEL_FAST = "gemini-3-flash-preview"; 

const cleanJson = (text: string | undefined): string => {
  if (!text) return "{}";
  let cleaned = text.trim();
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1];
  } else {
      const firstBrace = cleaned.indexOf('{');
      const firstBracket = cleaned.indexOf('[');
      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
          if (lastBrace !== -1) cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      } else if (firstBracket !== -1) {
          if (lastBracket !== -1) cleaned = cleaned.substring(firstBracket, lastBracket + 1);
      }
  }
  return cleaned.trim();
};

export const transcribeImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_VISION,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: `Transcribe handwriting exactly. Preserve breaks. Return raw text only.` }
        ]
      }
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to recognize handwriting.");
  }
};

export const getSynonyms = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Provide 6 distinct synonyms for: "${text}". Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { return []; }
};

export const expandText = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Expand this text descriptively: "${text}". Provide 6 different variations in a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { return []; }
};

export const checkGrammar = async (text: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Correct grammar/style: "${text}". Return 6 variations in a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { return []; }
};

export const quickFix = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Fix ONLY spelling/obvious grammar in "${text}". Return text only.`,
    });
    return response.text?.trim() || text;
  } catch (error) { return text; }
};

export const autoCorrect = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Standard proofread of: "${text}". Return only the corrected text.`,
    });
    return response.text?.trim() || text;
  } catch (error) { return text; }
};

export const analyzeParagraph = async (text: string, type: 'sensory' | 'show-dont-tell' | 'fluency' | 'sense-of-place'): Promise<string[]> => {
  const prompts = {
    sensory: 'Sensorize this text (smell, touch, sound).',
    'show-dont-tell': 'Apply Show Don\'t Tell.',
    fluency: 'Fix article/preposition usage for native fluency.',
    'sense-of-place': 'Ground the reader in the atmosphere/setting.'
  };
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `${prompts[type]} Text: "${text}". Return 4 variations in a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { return []; }
};

export const customRewrite = async (text: string, customPrompt: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Rewrite text based on: "${customPrompt}". Text: "${text}". Return 3 variations in a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { return []; }
};

export const researchTopic = async (query: string, previousContext: string = ""): Promise<{ content: string; sources: ResearchSource[] }> => {
  try {
    const prompt = previousContext 
      ? `Update research. Previous: ${previousContext.slice(-1000)}. New Request: "${query}".`
      : `Research deeply: "${query}". Format in Markdown.`;
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    
    // Fix: Explicitly type the extracted sources and handle potential null values from mapping
    const rawSources: (ResearchSource | null)[] = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .map((c: any) => c.web ? { title: c.web.title, url: c.web.uri } : null);
    
    const sources: ResearchSource[] = rawSources.filter((s): s is ResearchSource => s !== null);
    
    // Fix: Ensure deduplicated sources are correctly typed as ResearchSource[] to avoid 'unknown[]' assignment error
    const uniqueSources: ResearchSource[] = Array.from(new Map(sources.map((s) => [s.url, s])).values());

    return { content: response.text || "", sources: uniqueSources };
  } catch (error) { throw new Error("Research failed."); }
};

export const generateCharacter = async (prompt: string): Promise<Omit<Character, 'id' | 'timestamp' | 'history'>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Create character profile for: "${prompt}". Use Greimas Model. Return JSON only with name, greimasRole, coreDesire, description.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.OBJECT,
           properties: {
              name: { type: Type.STRING },
              greimasRole: { type: Type.STRING, enum: ['Subject', 'Object', 'Sender', 'Receiver', 'Helper', 'Opponent'] },
              coreDesire: { type: Type.STRING },
              description: { type: Type.STRING }
           },
           required: ['name', 'greimasRole', 'coreDesire', 'description']
        }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { throw new Error("Character gen failed."); }
};

export const generateCastFromStory = async (storyText: string): Promise<Omit<Character, 'id' | 'timestamp' | 'history'>[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Analyze story and identify characters using Greimas Model. Text: "${storyText.substring(0, 5000)}". Return JSON array of objects with name, greimasRole, coreDesire, description.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.ARRAY,
           items: {
               type: Type.OBJECT,
               properties: {
                  name: { type: Type.STRING },
                  greimasRole: { type: Type.STRING, enum: ['Subject', 'Object', 'Sender', 'Receiver', 'Helper', 'Opponent'] },
                  coreDesire: { type: Type.STRING },
                  description: { type: Type.STRING }
               },
               required: ['name', 'greimasRole', 'coreDesire', 'description']
           }
        }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) { throw new Error("Cast gen failed."); }
};

export const refineCharacter = async (character: Character, userPrompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Refine character ${character.name}. User: "${userPrompt}". Context: ${character.description}. Return Markdown update.`,
        });
        return response.text || "";
    } catch (error) { return "Error refining character."; }
};

export const analyzeStyle = async (text: string): Promise<StyleAnalysis> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Analyze writing style. Return JSON with voice, tone, pacing, readability, senseOfPlace, strengths (array), weaknesses (array), rhetoricalDevices (array), summary. TEXT: "${text.substring(0, 5000)}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        voice: { type: Type.STRING },
                        tone: { type: Type.STRING },
                        pacing: { type: Type.STRING },
                        readability: { type: Type.STRING },
                        senseOfPlace: { type: Type.STRING },
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                        rhetoricalDevices: { type: Type.ARRAY, items: { type: Type.STRING } },
                        summary: { type: Type.STRING }
                    },
                    required: ['voice', 'tone', 'pacing', 'readability', 'senseOfPlace', 'strengths', 'weaknesses', 'rhetoricalDevices', 'summary']
                }
            }
        });
        return JSON.parse(cleanJson(response.text));
    } catch (error) { throw new Error("Style analysis failed."); }
};

export const refineStyleAnalysis = async (analysis: StyleAnalysis, history: any[], userPrompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Discuss style analysis. User: "${userPrompt}". Summary: ${analysis.summary}.`,
    });
    return response.text || "";
  } catch (error) { return "Error discussing style."; }
};

export const generateSubtitles = async (title: string, manuscript: string): Promise<string[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Generate 5 subtitles for "${title}". Excerpt: "${manuscript.substring(0, 3000)}". Return JSON array.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        return JSON.parse(cleanJson(response.text));
    } catch (error) { return []; }
};

export const generateBlurb = async (title: string, manuscript: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Write book blurb for "${title}". Context: "${manuscript.substring(0, 5000)}".`,
        });
        return response.text || "";
    } catch (error) { return ""; }
};

export const generateCopyright = async (title: string, author: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: `Generate legal copyright text for "${title}" by ${author} (${new Date().getFullYear()}).`,
        });
        return response.text || "";
    } catch (error) { return ""; }
};

export const generateKDPTags = async (title: string, manuscript: string): Promise<string[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: `Generate 7 KDP tags for "${title}". Return JSON array.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        return JSON.parse(cleanJson(response.text));
    } catch (error) { return []; }
};
