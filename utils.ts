import { Block } from "./types";
import { v4 as uuidv4 } from 'uuid';

export const parseTextToBlocks = (text: string): Block[] => {
  // Normalize line endings:
  // Handle standard \r\n, \r
  // Handle Unicode line separators (\u2028) and paragraph separators (\u2029) often found in copy-paste
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[\r\u2028\u2029]/g, '\n');
  
  // Split by empty lines (double newlines). 
  // We use a regex that looks for 2 or more newlines (\n\n+), allowing for whitespace in between if any.
  // This preserves single newlines within a paragraph/block.
  const segments = normalized.split(/\n\s*\n/).filter(line => line.trim() !== '');

  return segments.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('##')) {
      return { id: uuidv4(), type: 'h2', content: trimmed.replace(/^##\s*/, '') };
    }
    if (trimmed.startsWith('#')) {
      return { id: uuidv4(), type: 'h1', content: trimmed.replace(/^#\s*/, '') };
    }
    // Recognize scene breaks (---, ***, ___)
    if (/^[-*_]{3,}$/.test(trimmed)) {
      return { id: uuidv4(), type: 'hr', content: '' };
    }
    return { id: uuidv4(), type: 'p', content: trimmed };
  });
};

export const countWords = (blocks: Block[]): number => {
  return blocks.reduce((acc, block) => {
    if (block.type === 'hr') return acc;
    return acc + block.content.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, 0);
};

export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Simple Word Diff for visual feedback
// Returns segments of text that are either 'unchanged' or 'changed' (new)
export const simpleWordDiff = (oldText: string, newText: string): { text: string; type: 'same' | 'added' }[] => {
    if (!oldText) return [{ text: newText, type: 'added' }];
    if (!newText) return [];
    if (oldText === newText) return [{ text: newText, type: 'same' }];

    const oldWords = oldText.split(/\b/); // Split keeping delimiters to preserve punctuation roughly
    const newWords = newText.split(/\b/);
    
    // Very naive alignment just for visual flair "underscoring"
    // Ideally we use Myers diff, but this is a heuristic for "Grammar Correction" where text is mostly same.
    
    const result: { text: string; type: 'same' | 'added' }[] = [];
    let iOld = 0;
    
    for (let iNew = 0; iNew < newWords.length; iNew++) {
        const word = newWords[iNew];
        
        // Skip whitespace in matching logic but keep in output
        if (/^\s+$/.test(word)) {
            result.push({ text: word, type: 'same' }); 
            // Try to advance old pointer if it matches whitespace
            if (iOld < oldWords.length && /^\s+$/.test(oldWords[iOld])) {
                iOld++;
            }
            continue;
        }

        // Look ahead in old text to find this word
        let found = false;
        // Search window of 10 tokens
        for (let offset = 0; offset < 10; offset++) {
            if (iOld + offset < oldWords.length && oldWords[iOld + offset] === word) {
                iOld += offset + 1; // Advance past this match
                found = true;
                break;
            }
        }

        if (found) {
            result.push({ text: word, type: 'same' });
        } else {
            result.push({ text: word, type: 'added' });
        }
    }
    
    return result;
};