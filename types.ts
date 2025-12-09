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

export type Theme = 'light' | 'dark' | 'system';

export type Mode = 'write' | 'edit';

export interface AIState {
  isLoading: boolean;
  error: string | null;
}

export interface TypographySettings {
  fontFamily: 'serif' | 'sans' | 'mono';
  fontSize: number; // in pixels or rem scale
}