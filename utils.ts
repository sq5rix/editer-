import { Block } from "./types";
import { v4 as uuidv4 } from 'uuid';

export const parseTextToBlocks = (text: string): Block[] => {
  // Normalize line endings:
  // Handle standard \r\n, \r
  // Handle Unicode line separators (\u2028) and paragraph separators (\u2029) often found in copy-paste
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[\r\u2028\u2029]/g, '\n');
  
  // Split by newlines (treating multiple newlines as a single break)
  let segments = normalized.split(/\n+/).filter(line => line.trim() !== '');

  // Heuristic: If parsing resulted in a single large block (> 150 chars),
  // the user likely pasted a wall of text without explicit newlines.
  // Attempt to split by sentence endings.
  if (segments.length === 1 && segments[0].length > 150) {
     // Regex breakdown:
     // ([.?!][)"']?)   -> Capture terminator (. ? !) optionally followed by closing quote/paren
     // \s+             -> One or more whitespace characters
     // (?=['"]?[A-Z])  -> Lookahead for optional opening quote and an uppercase letter
     const splitBySentence = segments[0]
        .replace(/([.?!][)"']?)\s+(?=['"]?[A-Z])/g, "$1\n")
        .split('\n')
        .filter(s => s.trim() !== '');
     
     if (splitBySentence.length > 1) {
        segments = splitBySentence;
     }
  }

  return segments.map(line => ({
    id: uuidv4(),
    type: line.trim().startsWith('#') ? 'h1' : 'p',
    content: line.trim().replace(/^#\s*/, '')
  }));
};

export const countWords = (blocks: Block[]): number => {
  return blocks.reduce((acc, block) => {
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