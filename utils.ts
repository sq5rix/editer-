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