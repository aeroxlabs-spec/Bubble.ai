

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

export type InputType = 'image' | 'text' | 'pdf';

export interface UserInput {
  id: string;
  type: InputType;
  content: string; // Base64 for image/pdf, raw text for text
  mimeType: string;
  preview?: string; // Data URL for image, or snippet for text
  fileName?: string;
}

// --- AUTH TYPES ---
export interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
}

// --- MODES ---

export type AppMode = 'SOLVER' | 'EXAM' | 'DRILL';

// --- EXAM TYPES ---

export type ExamDifficulty = 'STANDARD' | 'HARD' | 'HELL';

export type ExamCalculatorOption = 'YES' | 'NO' | 'MIXED';

export interface ExamSettings {
  durationMinutes: number;
  difficulty: ExamDifficulty;
  topics: string[];
  calculator: ExamCalculatorOption;
}

export interface ExamQuestion {
  id: string;
  number: string; // "1", "2a", etc.
  marks: number;
  questionText: string;
  markscheme: string; // LaTeX formatted
  shortAnswer: string;
  hint?: string;
  calculatorAllowed: boolean;
  steps?: string[]; // Simplified steps for the exam view
  graphSvg?: string;
}

export interface ExamSection {
  title: string; // "Section A", "Section B"
  questions: ExamQuestion[];
}

export interface ExamPaper {
  title: string;
  totalMarks: number;
  duration: number;
  sections: ExamSection[];
}

// --- DRILL TYPES ---

export interface DrillSettings {
  difficulty: ExamDifficulty;
  topics: string[];
  calculator: ExamCalculatorOption;
}

export interface DrillQuestion {
  id: string;
  number: number;
  topic: string;
  difficultyLevel: number; // 1-10
  questionText: string;
  shortAnswer: string;
  steps?: MathStep[]; // Optional, generated on demand
  hint: string;
  calculatorAllowed: boolean;
}