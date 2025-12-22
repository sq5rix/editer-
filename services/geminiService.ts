
import { GoogleGenAI, Type } from "@google/genai";
import { Block, ResearchSource, Character, StyleAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_TEXT = "gemini-3-pro-preview"; 
const MODEL_VISION = "gemini-3-flash-preview"; 
const MODEL_FAST = "gemini-3-flash-preview"; 

// Helper to strip Markdown code fences if present and extract JSON
const cleanJson = (text: string | undefined): string => {
  if (!text) return "{}";
  let cleaned = text.trim();

  // 1. Try to find markdown block with regex
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1];
  } else {
      // 2. If no code block, try to find the outer-most JSON structure
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
          { text: `You are a professional archivist expert in transcribing difficult handwriting.
          
          INSTRUCTIONS:
          1. Transcribe the text in the image exactly as written.
          2. Preserve paragraph breaks.
          3. Do not fix grammar or spelling errors unless they are obviously OCR mistakes.
          4. If a word is completely illegible, mark it as [?].
          5. Do not add any conversational filler. Return ONLY the raw text.
          ` }
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

export const quickFix = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Correct ONLY obvious typos and grammatical errors in the following text.
      
      STRICT RULES:
      1. Fix spelling mistakes (e.g. "teh" -> "the").
      2. Fix obvious grammar errors (e.g. "instisted to pay" -> "insisted on paying").
      3. DO NOT change word choice, tone, or style.
      4. DO NOT rephrase.
      5. If the text is correct, return it exactly as is.
      
      Text: "${text}"`,
    });
    return response.text?.trim() || text;
  } catch (error) {
    console.error("QuickFix Error:", error);
    return text;
  }
};

export const autoCorrect = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: `Correct standard grammar, spelling, and punctuation errors in the following text. 
      Keep the original voice, tone, and meaning exactly as is. 
      Return ONLY the corrected text.
      Text: "${text}"`,
    });
    return response.text?.trim() || text;
  } catch (error) {
    console.error("AutoCorrect Error:", error);
    return text;
  }
};

export const analyzeParagraph = async (text: string, type: 'sensory' | 'show-dont-tell' | 'fluency' | 'sense-of-place'): Promise<string[]> => {
  let prompt = "";
  if (type === 'sensory') {
      prompt = `Rewrite this paragraph 4 times. Focus deeply on "Sensorizing" it—adding details of smell, touch, sound, and sight. Make it vivid.`;
  } else if (type === 'show-dont-tell') {
      prompt = `Rewrite this paragraph 4 times applying the "Show, Don't Tell" principle. Instead of stating emotions or facts, describe the actions and environment that prove them.`;
  } else if (type === 'fluency') {
      prompt = `Rewrite this paragraph 4 times to sound more like a native English speaker. Focus specifically on correcting article usage (a/the), prepositions, and awkward phrasing. Keep the original meaning intact.`;
  } else if (type === 'sense-of-place') {
      prompt = `Rewrite this paragraph 4 times. Focus on "Sense of Place". Ground the reader in the setting by enhancing atmospheric details, lighting, spatial geography, and the mood of the environment.`;
  }

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
      contents: `Rewrite the following text based strictly on this instruction: "${customPrompt}". Provide 3 distinct variations. Text to rewrite: "${text}". Return ONLY a JSON array of strings.`,
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

export const researchTopic = async (query: string, previousContext: string = ""): Promise<{ content: string; sources: ResearchSource[] }> => {
  try {
    let prompt = `Research the following topic deeply and provide a comprehensive summary suitable for an editorial writer. 
      Topic/Question: "${query}". 
      Format the output in clear Markdown with headers. 
      Focus on facts, dates, key figures, and interesting details that could be used in a story.`;

    if (previousContext) {
      prompt = `You are an expert research assistant helping a writer.
      
      PREVIOUS CONTEXT:
      ${previousContext.slice(-2000)} ...

      NEW REQUEST:
      "${query}"

      Provide a direct and comprehensive answer to the new request, maintaining the context of the previous research. 
      Format with Markdown.`;
    }

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "No result found.";
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

    const uniqueSources = Array.from(new Map(sources.map(s => [s.url, s])).values());
    return { content: text, sources: uniqueSources };

  } catch (error) {
    console.error("Research Error:", error);
    throw new Error("Failed to perform research.");
  }
};

export const generateCharacter = async (prompt: string): Promise<Omit<Character, 'id' | 'timestamp' | 'history'>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Create a detailed character profile based on this input: "${prompt}". Use Greimas' Actantial Model.
      Return JSON only. Structure:
      {
        "name": "Character Name",
        "greimasRole": "One of: Subject, Object, Sender, Receiver, Helper, Opponent",
        "coreDesire": "1 sentence describing their goal.",
        "description": "Editorial-style paragraph."
      }`,
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
  } catch (error) {
    console.error("Character Gen Error:", error);
    throw new Error("Failed to generate character.");
  }
};

export const generateCastFromStory = async (storyText: string): Promise<Omit<Character, 'id' | 'timestamp' | 'history'>[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Analyze the following story text and identify main characters using Greimas' Actantial Model.
      Return ONLY a JSON array of objects with: name, greimasRole, coreDesire, description.
      STORY TEXT:
      "${storyText.substring(0, 15000)}"`,
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
  } catch (error) {
    console.error("Cast Gen Error:", error);
    throw new Error("Failed to generate cast from story.");
  }
};

export const refineCharacter = async (character: Character, userPrompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Refine this character: ${character.name}. Request: "${userPrompt}". 
            Context: ${character.description}. 
            Return Markdown.`,
        });
        return response.text || "";
    } catch (error) {
        console.error("Character Refine Error:", error);
        return "I couldn't process that refinement.";
    }
};

export const analyzeStyle = async (text: string): Promise<StyleAnalysis> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Analyze the writing style of the text. Return JSON only.
            TEXT: "${text.substring(0, 10000)}"`,
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
    } catch (error) {
        console.error("Style Analysis Error:", error);
        throw new Error("Failed to analyze style.");
    }
};

export const refineStyleAnalysis = async (analysis: StyleAnalysis, history: {role: string, content: string}[], userPrompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `Discuss this style analysis. User: "${userPrompt}". Analysis Summary: ${analysis.summary}.`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Refine Analysis Error:", error);
    return "I couldn't generate a response.";
  }
};

export const generateSubtitles = async (title: string, manuscript: string): Promise<string[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Generate 5 subtitles for "${title}". Manuscript excerpt: "${manuscript.substring(0, 5000)}". Return JSON array.`,
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
        console.error("Subtitle Gen Error:", error);
        return [];
    }
};

export const generateBlurb = async (title: string, manuscript: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Write a book blurb for "${title}". Context: "${manuscript.substring(0, 8000)}".`,
        });
        return response.text || "";
    } catch (error) {
        console.error("Blurb Gen Error:", error);
        return "";
    }
};

export const generateCopyright = async (title: string, author: string): Promise<string> => {
    try {
        const year = new Date().getFullYear();
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: `Generate copyright text for "${title}" by ${author} (${year}).`,
        });
        return response.text || "";
    } catch (error) {
        console.error("Copyright Gen Error:", error);
        return "";
    }
};

export const generateKDPTags = async (title: string, manuscript: string): Promise<string[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FAST,
            contents: `Generate 7 KDP tags for "${title}". Excerpt: "${manuscript.substring(0, 3000)}". Return JSON array.`,
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
        console.error("KDP Tags Gen Error:", error);
        return [];
    }
};
