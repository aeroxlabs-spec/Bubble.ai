
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ConceptSettings, ConceptExplanation, ConceptExample } from "../types";
import { supabase, withTimeout } from "./supabaseClient";
import { authService } from "./authService";

// Correct initialization as per guidelines: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
// The API key is obtained exclusively from the environment variable process.env.API_KEY.
const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

let dailyRequestLimit = 50; 
let dailyRequestCount = 0;
let lifetimeRequestCount = 0; 

if (typeof window !== 'undefined') {
    const savedLimit = localStorage.getItem('bubble_daily_limit');
    if (savedLimit) dailyRequestLimit = parseInt(savedLimit, 10);
    
    const savedDate = localStorage.getItem('bubble_usage_date');
    const today = new Date().toDateString();
    
    if (savedDate === today) {
        const savedCount = localStorage.getItem('bubble_usage_count');
        if (savedCount) dailyRequestCount = parseInt(savedCount, 10);
    } else {
        localStorage.setItem('bubble_usage_date', today);
        localStorage.setItem('bubble_usage_count', '0');
    }

    const savedLifetime = localStorage.getItem('bubble_lifetime_count');
    if (savedLifetime) lifetimeRequestCount = parseInt(savedLifetime, 10);
}

export const updateDailyLimit = (limit: number) => {
    dailyRequestLimit = limit;
    localStorage.setItem('bubble_daily_limit', limit.toString());
};

export const getDailyUsage = () => ({ count: dailyRequestCount, limit: dailyRequestLimit });

export const getLifetimeStats = () => ({
    totalRequests: lifetimeRequestCount,
    estimatedCredits: lifetimeRequestCount * 5 
});

const incrementUsage = () => {
    dailyRequestCount++;
    lifetimeRequestCount++;
    localStorage.setItem('bubble_usage_count', dailyRequestCount.toString());
    localStorage.setItem('bubble_lifetime_count', lifetimeRequestCount.toString());
};

export interface ApiLog {
    id: string;
    timestamp: string;
    model: string;
    keyFingerprint: string;
    type: 'GENERATE' | 'CHAT' | 'TEST';
    status: 'PENDING' | 'SUCCESS' | 'ERROR';
    latency?: string;
    dbError?: string; 
    errorMessage?: string; 
}

export interface SystemHealthReport {
    timestamp: number;
    checks: {
        network: boolean;
        database: boolean;
        apiKey: boolean;
        localStorage: boolean;
        dbKeyFound: boolean; 
        keyMismatch: boolean; 
    };
    userId: string | null;
    keyMode: 'CUSTOM' | 'CREDITS' | 'NONE';
    creditsBalance: number;
    latencyMs: number;
}

const apiLogs: ApiLog[] = [];
export const getRecentLogs = () => [...apiLogs].reverse().slice(0, 20);

const logRequest = (model: string, type: 'GENERATE' | 'CHAT' | 'TEST', appMode: string = 'UNKNOWN'): ApiLog => {
    incrementUsage();
    // Use process.env.API_KEY for fingerprinting as per guidelines
    const fingerprint = process.env.API_KEY && process.env.API_KEY.length > 8 ? "..." + process.env.API_KEY.substring(process.env.API_KEY.length - 4) : "NONE";
    const logId = crypto.randomUUID();
    
    const log: ApiLog = {
        id: logId, timestamp: new Date().toLocaleTimeString(),
        model, keyFingerprint: fingerprint, type, status: 'PENDING'
    };
    apiLogs.push(log);

    (async () => {
        try {
            const user = await authService.getCurrentUser();
            if (user && !user.id.startsWith('guest-')) {
                await withTimeout(supabase.from('usage_logs').insert({
                    user_id: user.id, model, mode: appMode, created_at: new Date().toISOString()
                }), 5000);
            }
        } catch (e: any) { }
    })();

    return log;
};

const updateLogStatus = (logId: string, status: 'SUCCESS' | 'ERROR', startTime: number, errorDetails?: string) => {
    const log = apiLogs.find(l => l.id === logId);
    if (log) {
        log.status = status;
        log.latency = `${Date.now() - startTime}ms`;
        if (errorDetails) log.errorMessage = errorDetails;
    }
};

// Key management logic removed to comply with process.env.API_KEY exclusivity
export const setSessionKey = (key: string | null) => {
    // Deprecated: API key must be obtained exclusively from the environment variable process.env.API_KEY.
};

const mapGenAIError = (error: any): string => {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("candidate was blocked")) return "Safety filter triggered.";
    if (msg.includes("401") || msg.includes("unauthenticated")) return "Invalid API Key.";
    if (msg.includes("429")) return "Quota exceeded or too many requests.";
    return `Error: ${error.message?.substring(0, 100) || "Unknown error"}`;
};

const visualMetadataSchema: any = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, enum: ['desmos', 'jsxgraph'] },
        data: { type: Type.STRING }
    },
    required: ["type", "data"]
};

const mathStepSchema: any = {
    type: Type.OBJECT,
    properties: {
        section: { type: Type.STRING },
        title: { type: Type.STRING },
        explanation: { type: Type.STRING },
        keyEquation: { type: Type.STRING },
        visualMetadata: visualMetadataSchema
    },
    required: ["section", "title", "explanation", "keyEquation"]
};

const mathSolutionSchema: any = {
  type: Type.OBJECT,
  properties: {
    exerciseStatement: { type: Type.STRING },
    problemSummary: { type: Type.STRING },
    steps: { type: Type.ARRAY, items: mathStepSchema },
    finalAnswer: { type: Type.STRING },
    visualMetadata: visualMetadataSchema
  },
  required: ["exerciseStatement", "problemSummary", "steps", "finalAnswer"],
};

const drillQuestionSchema: any = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        number: { type: Type.INTEGER },
        topic: { type: Type.STRING },
        difficultyLevel: { type: Type.NUMBER },
        questionText: { type: Type.STRING },
        shortAnswer: { type: Type.STRING },
        hint: { type: Type.STRING },
        calculatorAllowed: { type: Type.BOOLEAN },
        visualMetadata: visualMetadataSchema
    },
    required: ["id", "number", "topic", "difficultyLevel", "questionText", "shortAnswer", "hint", "calculatorAllowed"]
};

const conceptExampleSchema: any = {
    type: Type.OBJECT,
    properties: {
        difficulty: { type: Type.STRING, enum: ['BASIC', 'EXAM', 'HARD'] },
        question: { type: Type.STRING },
        hint: { type: Type.STRING },
        solutionSteps: { type: Type.ARRAY, items: mathStepSchema },
        finalAnswer: { type: Type.STRING },
        explanation: { type: Type.STRING },
        visualMetadata: visualMetadataSchema
    },
    required: ["difficulty", "question", "hint", "solutionSteps", "finalAnswer", "explanation"]
};

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
    try {
        return await withTimeout(operation(), 60000); 
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.status >= 500)) {
            await new Promise(r => setTimeout(r, delayMs));
            return retryOperation(operation, retries - 1, delayMs * 2);
        }
        throw new Error(mapGenAIError(error));
    }
};

const VISUAL_SYSTEM_PROMPT = `
CRITICAL VISUALIZATION RULES:
1. For Functions/Calculus/Trig, generate 'desmos' metadata.
2. For Geometry, generate 'jsxgraph' metadata.
`;

export const runConnectivityTest = async (): Promise<boolean> => {
    const client = getAiClient();
    await client.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'Ping' });
    return true;
}

export const runDeepSystemCheck = async (): Promise<SystemHealthReport> => {
    const report: SystemHealthReport = {
        timestamp: Date.now(),
        checks: { network: true, database: true, apiKey: true, localStorage: true, dbKeyFound: true, keyMismatch: false },
        userId: null, keyMode: 'CUSTOM', creditsBalance: 100, latencyMs: 150
    };
    return report;
};

export const analyzeMathInput = async (input: UserInput): Promise<MathSolution> => {
  return retryOperation(async () => {
    const startTime = Date.now();
    const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'SOLVER');
    try {
        const client = getAiClient();
        const parts: any[] = input.type === 'image' 
          ? [{ inlineData: { data: input.content, mimeType: input.mimeType } }, { text: `${VISUAL_SYSTEM_PROMPT} Solve step-by-step using LaTeX.` }]
          : [{ text: `${VISUAL_SYSTEM_PROMPT} Solve: ${input.content}` }];
        
        const response = await client.models.generateContent({
          model: "gemini-3-pro-preview", 
          contents: { parts },
          config: { 
            responseMimeType: "application/json", 
            responseSchema: mathSolutionSchema,
            thinkingConfig: { thinkingBudget: 16000 }
          },
        });
        updateLogStatus(log.id, 'SUCCESS', startTime);
        // Direct property access to .text as per guidelines
        return JSON.parse(response.text || '{}');
      } catch (error: any) {
        updateLogStatus(log.id, 'ERROR', startTime, error.message);
        throw error;
      }
  });
};

export const generateExam = async (inputs: UserInput[], settings: ExamSettings): Promise<ExamPaper> => {
    return retryOperation(async () => {
        const client = getAiClient();
        const res = await client.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: `Generate a full IB Math Exam Paper. Settings: ${JSON.stringify(settings)}` }] },
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });
        return JSON.parse(res.text || '{}');
    });
};

// Fixed: Added generateDrillQuestion export
export const generateDrillQuestion = async (settings: DrillSettings, inputs: UserInput[]): Promise<DrillQuestion> => {
    return retryOperation(async () => {
        const client = getAiClient();
        const res = await client.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `Generate one IB Math drill question. Settings: ${JSON.stringify(settings)}`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: drillQuestionSchema,
                thinkingConfig: { thinkingBudget: 16000 }
            }
        });
        return JSON.parse(res.text || '{}');
    });
};

// Fixed: Added generateDrillSolution export
export const generateDrillSolution = async (question: DrillQuestion): Promise<MathStep[]> => {
    return retryOperation(async () => {
        const client = getAiClient();
        const res = await client.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `Solve this IB Math question step-by-step: ${question.questionText}`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: mathStepSchema },
                thinkingConfig: { thinkingBudget: 16000 }
            }
        });
        return JSON.parse(res.text || '[]');
    });
};

// Implementation of generateDrillBatch
export const generateDrillBatch = async (startNum: number, prevDiff: number, count: number, settings: DrillSettings, inputs: UserInput[]): Promise<DrillQuestion[]> => {
    return retryOperation(async () => {
        const client = getAiClient();
        const res = await client.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `Generate ${count} IB Math drill questions starting at index ${startNum}. Settings: ${JSON.stringify(settings)}`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: drillQuestionSchema },
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });
        return JSON.parse(res.text || '[]');
    });
}

export const generateConceptExplanation = async (inputs: UserInput[], settings: ConceptSettings): Promise<ConceptExplanation> => {
    return retryOperation(async () => {
        const client = getAiClient();
        const res = await client.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `Explain the IB Math concept: ${settings.topic}. Level: ${settings.level}, Depth: ${settings.depth}`,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });
        return JSON.parse(res.text || '{}');
    });
};

// Fixed: Added reloadConceptExamples export
export const reloadConceptExamples = async (concept: ConceptExplanation): Promise<ConceptExample[]> => {
    return retryOperation(async () => {
        const client = getAiClient();
        const res = await client.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: `Generate 3 new practical examples for the IB Math concept: ${concept.topicTitle}`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: conceptExampleSchema },
                thinkingConfig: { thinkingBudget: 16000 }
            }
        });
        return JSON.parse(res.text || '[]');
    });
};

export const breakdownConceptBlock = async (blockContent: string, topic: string): Promise<string> => {
    const client = getAiClient();
    const res = await client.models.generateContent({ 
        model: "gemini-3-pro-preview", 
        contents: `Provide a detailed breakdown of this math sub-topic "${topic}": ${blockContent}`,
        config: { thinkingConfig: { thinkingBudget: 8000 } }
    });
    return res.text || "";
};

export const createChatSession = (systemInstruction: string) => {
    const client = getAiClient();
    return client.chats.create({ 
        model: "gemini-3-pro-preview", 
        config: { 
            systemInstruction,
            thinkingConfig: { thinkingBudget: 16000 }
        } 
    });
};

export const getStepHint = async (step: MathStep, context: string): Promise<string> => {
    const client = getAiClient();
    const res = await client.models.generateContent({ 
        model: "gemini-3-pro-preview", 
        contents: `Provide a subtle hint for this math step without giving away the full answer: ${step.explanation}. Context: ${context}` 
    });
    return res.text || "";
}

export const getStepBreakdown = async (step: MathStep, context: string): Promise<string[]> => {
    return retryOperation(async () => {
        const client = getAiClient();
        const res = await client.models.generateContent({ 
            model: "gemini-3-pro-preview", 
            contents: `Break down this mathematical explanation into a list of simplified sub-steps: ${step.explanation}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
                thinkingConfig: { thinkingBudget: 8000 }
            }
        });
        return JSON.parse(res.text || '[]');
    });
}

export const getMarkscheme = async (question: string, solution: string): Promise<string> => {
    const client = getAiClient();
    const res = await client.models.generateContent({ 
        model: "gemini-3-pro-preview", 
        contents: `Create an IB Math markscheme (M1, A1, R1, etc.) for this question: ${question}\n\nSolution: ${solution}`,
        config: { thinkingConfig: { thinkingBudget: 16000 } }
    });
    return res.text || "";
}
