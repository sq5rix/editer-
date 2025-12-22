
import { Block } from "./types";
import { v4 as uuidv4 } from 'uuid';

/**
 * Intelligent parser that converts raw text into structured editorial blocks.
 * Designed to handle both clean digital text and messy OCR/Handwriting.
 */
export const parseTextToBlocks = (text: string): Block[] => {
  if (!text) return [];

  // Normalize line endings
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[\r\u2028\u2029]/g, '\n')
    .trim();

  if (!normalized) return [];

  // HEURISTIC: Determine the likely paragraph separator.
  // If there are double newlines, they are the intentional separators.
  // If there are ONLY single newlines, every newline is a separator.
  const hasDoubleNewlines = normalized.includes('\n\n');
  
  let segments: string[];
  if (hasDoubleNewlines) {
    segments = normalized.split(/\n{2,}/);
  } else {
    // If it's a giant block of single lines (common in OCR), split by line.
    segments = normalized.split('\n');
  }

  const finalBlocks: Block[] = [];

  segments.forEach(seg => {
    const content = seg.trim();
    if (!content) return;

    // Detect structural markers
    if (content.startsWith('##')) {
      finalBlocks.push({ id: uuidv4(), type: 'h2', content: content.replace(/^##\s*/, '') });
    } else if (content.startsWith('#')) {
      finalBlocks.push({ id: uuidv4(), type: 'h1', content: content.replace(/^#\s*/, '') });
    } else if (/^[-*_]{3,}$/.test(content)) {
      finalBlocks.push({ id: uuidv4(), type: 'hr', content: '' });
    } else {
      // It's a paragraph
      finalBlocks.push({ id: uuidv4(), type: 'p', content });
    }
  });

  // Fallback: if somehow nothing was parsed but text exists
  if (finalBlocks.length === 0 && normalized.length > 0) {
    finalBlocks.push({ id: uuidv4(), type: 'p', content: normalized });
  }

  return finalBlocks;
};

export const countWords = (blocks: Block[]): number => {
  return blocks.reduce((acc, block) => {
    if (block.type === 'hr') return acc;
    return acc + block.content.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, 0);
};

export const simpleWordDiff = (oldText: string, newText: string): { text: string; type: 'same' | 'added' }[] => {
    if (!oldText) return [{ text: newText, type: 'added' }];
    if (!newText) return [];
    if (oldText === newText) return [{ text: newText, type: 'same' }];

    const oldWords = oldText.split(/\b/);
    const newWords = newText.split(/\b/);
    
    const result: { text: string; type: 'same' | 'added' }[] = [];
    let iOld = 0;
    
    for (let iNew = 0; iNew < newWords.length; iNew++) {
        const word = newWords[iNew];
        if (/^\s+$/.test(word)) {
            result.push({ text: word, type: 'same' }); 
            if (iOld < oldWords.length && /^\s+$/.test(oldWords[iOld])) iOld++;
            continue;
        }

        let found = false;
        for (let offset = 0; offset < 10; offset++) {
            if (iOld + offset < oldWords.length && oldWords[iOld + offset] === word) {
                iOld += offset + 1;
                found = true;
                break;
            }
        }

        if (found) result.push({ text: word, type: 'same' });
        else result.push({ text: word, type: 'added' });
    }
    
    return result;
};
