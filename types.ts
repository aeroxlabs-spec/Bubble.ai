
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
  graphFunctions?: string[]; // Array of math expressions for plotting (e.g. "x^2")
  geometrySvg?: string; // Raw SVG string for geometry/trigonometry figures
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
    hasOnboarded: boolean;
}

// --- MODES ---

export type AppMode = 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';

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
  graphFunctions?: string[]; // For plotting
  geometrySvg?: string; // SVG for geometry
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
  graphFunctions?: string[]; // For plotting
  geometrySvg?: string; // SVG for geometry
}

// --- CONCEPT TYPES ---

export type IBLevel = 'SL' | 'HL';
export type ConceptDepth = 'SUMMARY' | 'DETAILED';

export interface ConceptSettings {
    topic: string;
    level: IBLevel;
    depth: ConceptDepth;
}

export type ExampleDifficulty = 'BASIC' | 'EXAM' | 'HARD';

export interface ConceptExample {
    difficulty: ExampleDifficulty;
    question: string;
    hint: string;
    solutionSteps: MathStep[]; // Reusing MathStep for consistency
    finalAnswer: string;
    explanation: string; // Brief theoretical context
    graphFunctions?: string[];
    geometrySvg?: string;
}

export interface ConceptBlock {
    title: string; // e.g., "The Logic", "Derivation"
    content: string; // The explanation text
    keyEquation?: string; // Optional emphasized formula
}

export interface ConceptExplanation {
    topicTitle: string;
    introduction: string; // Short paragraph
    conceptBlocks: ConceptBlock[]; // The body divided into ideas
    coreFormulas?: string[]; // Optional formulas block
    examples: ConceptExample[]; // Must be 3 (Basic, Exam, Hard)
}

// --- FEEDBACK TYPES (V2) ---

export type FeedbackType = 'general' | 'bug' | 'feature' | 'help';

export interface FeedbackMetadata {
    userEmail?: string;
    userName?: string;
    context?: string;
    [key: string]: any;
}

export interface FeedbackV2 {
    id: string;
    created_at: string;
    user_id: string;
    type: FeedbackType;
    title: string | null;
    body: string;
    metadata: FeedbackMetadata;
    resolved: boolean;
    resolved_at: string | null;
    resolved_by: string | null;
}
