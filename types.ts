
export interface Block {
  id: string;
  type: 'h1' | 'p';
  content: string;
}

export interface BookEntry {
  id: string;
  title: string;
  createdAt: number;
  lastModified: number;
}

export interface Suggestion {
  type: 'synonym' | 'expand' | 'grammar' | 'sensory' | 'show-dont-tell' | 'fluency';
  originalText: string;
  options: string[];
}

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchInteraction {
  id: string;
  query: string;
  content: string;
  sources: ResearchSource[];
  timestamp: number;
}

export interface ResearchThread {
  id: string;
  title: string;
  interactions: ResearchInteraction[];
  createdAt: number;
  lastModified: number;
}

export interface BraindumpItem {
  id: string;
  content: string;
  timestamp: number;
}

export interface CharacterMessage {
  role: 'user' | 'model';
  content: string;
}

export interface Character {
  id: string;
  name: string;
  greimasRole: 'Subject' | 'Object' | 'Sender' | 'Receiver' | 'Helper' | 'Opponent';
  description: string;
  coreDesire: string; // The 'Object' they seek (if Subject) or represent
  history: CharacterMessage[]; // For follow-up refinements
  timestamp: number;
}

export interface StyleAnalysis {
  voice: string;
  tone: string;
  pacing: string;
  readability: string;
  strengths: string[];
  weaknesses: string[];
  rhetoricalDevices: string[];
  summary: string;
}

export interface BookMetadata {
  title: string;
  subtitle: string;
  author: string;
  blurb: string;
  copyright: string;
  kdpTags: string[];
}

export interface User {
  name: string;
  email: string;
  picture: string;
}

export type Theme = 'light' | 'dark' | 'system';

export type Mode = 'metadata' | 'braindump' | 'research' | 'write' | 'edit' | 'shuffle' | 'characters' | 'analysis';

export interface AIState {
  isLoading: boolean;
  error: string | null;
}

export interface TypographySettings {
  fontFamily: 'serif' | 'sans' | 'mono';
  fontSize: number; // in pixels
  contrast: number; // 0.1 to 1.0 opacity value
}
