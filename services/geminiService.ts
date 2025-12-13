import { GoogleGenAI, Type } from "@google/genai";
import { Block, ResearchSource, Character, StyleAnalysis } from "../types";

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

export const analyzeParagraph = async (text: string, type: 'sensory' | 'show-dont-tell' | 'fluency'): Promise<string[]> => {
  let prompt = "";
  if (type === 'sensory') {
      prompt = `Rewrite this paragraph 4 times. Focus deeply on "Sensorizing" it—adding details of smell, touch, sound, and sight. Make it vivid.`;
  } else if (type === 'show-dont-tell') {
      prompt = `Rewrite this paragraph 4 times applying the "Show, Don't Tell" principle. Instead of stating emotions or facts, describe the actions and environment that prove them.`;
  } else if (type === 'fluency') {
      prompt = `Rewrite this paragraph 4 times to sound more like a native English speaker. Focus specifically on correcting article usage (a/the), prepositions, and awkward phrasing. Keep the original meaning intact.`;
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

export const generateCharacter = async (prompt: string): Promise<Omit<Character, 'id' | 'timestamp' | 'history'>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: `You are an expert narratologist. Create a detailed character profile based on this input: "${prompt}".
      
      CRITICAL: You must analyze the character through the lens of the Greimas Actantial Model.
      Assign one of the following roles based on the input:
      - Subject (The hero/protagonist)
      - Object (What the subject wants)
      - Sender (What instigates the action)
      - Receiver (Who benefits)
      - Helper (Aids the subject)
      - Opponent (Hinders the subject)

      Return JSON only. Structure:
      {
        "name": "Character Name",
        "greimasRole": "One of the 6 roles above",
        "coreDesire": "1 sentence describing their abstract or concrete goal (The Object)",
        "description": "A rich, editorial-style paragraph describing appearance, personality, and their narrative function."
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

export const refineCharacter = async (character: Character, userPrompt: string): Promise<string> => {
    try {
        const context = `
        Character Name: ${character.name}
        Greimas Role: ${character.greimasRole}
        Core Desire: ${character.coreDesire}
        Description: ${character.description}
        
        Previous Conversation:
        ${character.history.map(m => `${m.role}: ${m.content}`).join('\n')}
        `;

        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `You are a creative writing assistant helping to develop a character.
            
            CONTEXT:
            ${context}

            USER REQUEST:
            "${userPrompt}"

            Provide a creative, detailed response that expands on the character. Keep the tone editorial and literary. Do NOT return JSON. Return Markdown text.`,
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
            contents: `Analyze the writing style of the provided text. Act as a literary editor.
            
            TEXT TO ANALYZE:
            "${text.substring(0, 10000)}"

            Provide a deep stylistic analysis including:
            - Voice (e.g., Authoritative, Whimsical, Dry)
            - Tone (e.g., Optimistic, Cynical, Neutral)
            - Pacing (e.g., Fast, Methodical, Staccato)
            - Readability (e.g., Simple, Moderate, Complex, Academic)
            - 3 Key Strengths
            - 3 Areas for improvement or stylistic weaknesses
            - Rhetorical Devices used (up to 4)
            - A summary paragraph describing the "Style Fingerprint".

            Return JSON only.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        voice: { type: Type.STRING },
                        tone: { type: Type.STRING },
                        pacing: { type: Type.STRING },
                        readability: { type: Type.STRING },
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                        rhetoricalDevices: { type: Type.ARRAY, items: { type: Type.STRING } },
                        summary: { type: Type.STRING }
                    },
                    required: ['voice', 'tone', 'pacing', 'readability', 'strengths', 'weaknesses', 'rhetoricalDevices', 'summary']
                }
            }
        });

        return JSON.parse(cleanJson(response.text));
    } catch (error) {
        console.error("Style Analysis Error:", error);
        throw new Error("Failed to analyze style.");
    }
};

// -- BOOK METADATA GENERATORS --

export const generateSubtitles = async (title: string, manuscript: string): Promise<string[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TEXT,
            contents: `Generate 5 compelling, market-ready subtitles for a book titled "${title}".
            
            MANUSCRIPT EXCERPT:
            "${manuscript.substring(0, 5000)}"
            
            Return ONLY a JSON array of strings.`,
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
            contents: `Write a compelling, professional book blurb (back cover copy) for a book titled "${title}".
            
            MANUSCRIPT CONTEXT:
            "${manuscript.substring(0, 8000)}"
            
            The blurb should engage the reader, hint at the core conflict or value, and end with a hook. Return Markdown text.`,
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
            contents: `Generate a standard copyright page text for:
            Title: "${title}"
            Author: "${author}"
            Year: ${year}
            
            Include standard disclaimers for fiction or non-fiction (infer from title). Return plain text with proper formatting.`,
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
            contents: `Generate 7 optimized Amazon KDP keywords/phrases for a book titled "${title}".
            
            CONTEXT:
            "${manuscript.substring(0, 3000)}"
            
            Focus on search intent and genre specifics. Return ONLY a JSON array of 7 strings.`,
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