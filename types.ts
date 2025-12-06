
export interface MathStep {
  section: string;
  title: string;
  explanation: string;
  keyEquation: string;
}

export interface MathSolution {
  exerciseStatement: string;
  problemSummary: string;
  steps: MathStep[];
  finalAnswer: string;
  markscheme?: string; // Optional, loaded on demand
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SOLVED = 'SOLVED',
  ERROR = 'ERROR'
}

export type InputType = 'image' | 'text';

export interface UserInput {
  id: string;
  type: InputType;
  content: string; // Base64 for image, raw text for text
  mimeType: string;
  preview?: string; // Data URL for image, or snippet for text
}
