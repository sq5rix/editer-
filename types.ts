export interface Block {
  id: string;
  type: 'h1' | 'p';
  content: string;
}

export interface Suggestion {
  type: 'synonym' | 'expand' | 'grammar' | 'sensory' | 'show-dont-tell';
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

export type Theme = 'light' | 'dark' | 'system';

export type Mode = 'research' | 'write' | 'edit' | 'shuffle';

export interface AIState {
  isLoading: boolean;
  error: string | null;
}

export interface TypographySettings {
  fontFamily: 'serif' | 'sans' | 'mono';
  fontSize: number; // in pixels
  contrast: number; // 0.1 to 1.0 opacity value
}