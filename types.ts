export interface VisualMetadata {
  type: 'desmos' | 'jsxgraph';
  /** 
   * For desmos: a list of expressions separated by ';' or a JSON config.
   * For jsxgraph: a safe stringified representation of construction instructions.
   */
  data: string;
}

export interface MathStep {
  section: string;
  title: string;
  explanation: string;
  keyEquation: string;
  visualMetadata?: VisualMetadata;
}

export interface MathSolution {
  exerciseStatement: string;
  problemSummary: string;
  steps: MathStep[];
  finalAnswer: string;
  markscheme?: string; 
  visualMetadata?: VisualMetadata;
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
  content: string; 
  mimeType: string;
  preview?: string; 
  fileName?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    hasOnboarded: boolean;
}

export type AppMode = 'SOLVER' | 'EXAM' | 'DRILL' | 'CONCEPT';

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
  number: string; 
  marks: number;
  questionText: string;
  markscheme: string; 
  shortAnswer: string;
  hint?: string;
  calculatorAllowed: boolean;
  steps?: string[]; 
  graphSvg?: string;
  visualMetadata?: VisualMetadata;
}

export interface ExamSection {
  title: string; 
  questions: ExamQuestion[];
}

export interface ExamPaper {
  title: string;
  totalMarks: number;
  duration: number;
  sections: ExamSection[];
}

export interface DrillSettings {
  difficulty: ExamDifficulty;
  topics: string[];
  calculator: ExamCalculatorOption;
}

export interface DrillQuestion {
  id: string;
  number: number;
  topic: string;
  difficultyLevel: number; 
  questionText: string;
  shortAnswer: string;
  steps?: MathStep[]; 
  hint: string;
  calculatorAllowed: boolean;
  visualMetadata?: VisualMetadata;
}

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
    solutionSteps: MathStep[]; 
    finalAnswer: string;
    explanation: string; 
    visualMetadata?: VisualMetadata;
}

export interface ConceptBlock {
    title: string; 
    content: string; 
    keyEquation?: string; 
    visualMetadata?: VisualMetadata;
}

export interface ConceptExplanation {
    topicTitle: string;
    introduction: string; 
    conceptBlocks: ConceptBlock[]; 
    coreFormulas?: string[]; 
    examples: ConceptExample[]; 
}

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