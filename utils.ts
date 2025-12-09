import { Block } from "./types";
import { v4 as uuidv4 } from 'uuid';

export const parseTextToBlocks = (text: string): Block[] => {
  return text.split('\n').filter(line => line.trim() !== '').map(line => ({
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
