
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty, ConceptSettings, ConceptExplanation, ConceptExample } from "../types";
import { supabase, withTimeout } from "./supabaseClient";
import { authService } from "./authService";

/**
 * Local interface for Gemini response schema, as 'Schema' is not a named export in the current @google/genai SDK.
 */
interface ResponseSchema {
    type: Type;
    properties?: Record<string, any>;
    required?: string[];
    items?: any;
    description?: string;
    enum?: string[];
}

/**
 * Initialize the Google GenAI client once using the pre-configured environment variable.
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

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

const checkUsageLimit = () => {
    if (dailyRequestCount >= dailyRequestLimit) {
        console.warn(`Daily limit of ${dailyRequestLimit} requests reached.`);
    }
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
    checkUsageLimit();
    
    const fingerprint = "ENV_KEY";
    const logId = crypto.randomUUID();
    
    const log: ApiLog = {
        id: logId,
        timestamp: new Date().toLocaleTimeString(),
        model,
        keyFingerprint: fingerprint,
        type,
        status: 'PENDING'
    };
    apiLogs.push(log);

    (async () => {
        try {
            const user = await authService.getCurrentUser();
            if (user && !user.id.startsWith('guest-')) {
                const { error } = await withTimeout(supabase.from('usage_logs').insert({
                    user_id: user.id,
                    model: model,
                    mode: appMode,
                    created_at: new Date().toISOString()
                }), 5000).catch(e => ({ error: { message: "Log Timeout" } })) as any;

                if (error) {
                    const targetLog = apiLogs.find(l => l.id === logId);
                    if (targetLog) targetLog.dbError = `DB_ERROR: ${error.message}`;
                }
            }
        } catch (e: any) {
            const targetLog = apiLogs.find(l => l.id === logId);
            if (targetLog) targetLog.dbError = `DB_EXCEPTION: ${e.message}`;
        }
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

export const setSessionKey = (key: string | null) => {
    // Key management is now handled exclusively via process.env.API_KEY
};

const getApiKey = () => {
    return "ENV_KEY";
};

export const getKeyFingerprint = () => {
    return "ENV_KEY";
}

export const getSystemDiagnostics = () => {
    return {
        hasApiKey: true,
        keyLength: 0,
        keyPrefix: "ENV",
        envCheck: {
            sessionKey: false,
            localStorage: false,
            vite: false, 
            process: true, 
        }
    }
};

export const runDeepSystemCheck = async (): Promise<SystemHealthReport> => {
    const startTime = Date.now();
    const report: SystemHealthReport = {
        timestamp: startTime,
        checks: {
            network: navigator.onLine,
            database: false,
            apiKey: false,
            localStorage: typeof window !== 'undefined' && !!window.localStorage,
            dbKeyFound: false,
            keyMismatch: false
        },
        userId: null,
        keyMode: 'CUSTOM',
        creditsBalance: 0,
        latencyMs: 0
    };

    try {
        const user = await authService.getCurrentUser();
        if (user) {
            report.userId = user.id;
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                report.checks.database = true;
            }
        }
    } catch (e) {
        console.error("Diagnostic: DB Check Failed", e);
    }

    try {
         const startPing = Date.now();
         // Use gemini-3-flash-preview for a basic connectivity check
         await withTimeout(ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: 'Ping' }] }
         }), 10000);
         report.latencyMs = Date.now() - startPing;
         report.checks.apiKey = true;
    } catch (e) {
         console.error("Diagnostic: API Ping Failed", e);
         report.checks.apiKey = false;
    }

    return report;
};

const mapGenAIError = (error: any): string => {
    const msg = (error.message || "").toLowerCase();
    const status = error.status || 0;

    if (msg.includes("candidate was blocked") || msg.includes("safety") || msg.includes("finishreason")) {
        return "Safety Filter Triggered. The AI refused to answer this specific prompt. Please try rephrasing or using a different image.";
    }

    if (msg.includes("location is not supported") || msg.includes("region_not_supported") || (status === 400 && msg.includes("location"))) {
        return "Region Not Supported. Google Gemini is not currently available in your location (Error 400). A VPN might help.";
    }

    if (status === 401 || msg.includes("401") || msg.includes("unauthenticated") || msg.includes("invalid api key")) {
        return "Invalid API Key (401). The key is incorrect or revoked.";
    }

    if (status === 403 || msg.includes("403") || msg.includes("permission denied")) {
        return "Access Denied (403). Ensure the 'Generative Language API' is enabled in your Google Cloud Project.";
    }

    if (status === 429 || msg.includes("429") || msg.includes("resource_exhausted")) {
        if (msg.includes("quota")) {
            return "Daily Quota Exceeded. You have hit the limit for this API key.";
        }
        return "Traffic Limit Reached. You are sending requests too quickly. Please wait 30 seconds and try again.";
    }

    if (status >= 500 || msg.includes("internal server error")) {
        return "Google AI Service Error (5xx). The AI service is temporarily down. Please try again in a few minutes.";
    }

    if (msg.includes("json") || msg.includes("syntaxerror")) {
        return "Data Processing Error. The AI returned an invalid format. Please try again.";
    }

    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("failed to fetch") || msg.includes("timed out")) {
        return "Network Connection Failed. Please check your internet connection and try again.";
    }

    return `Error: ${error.message?.substring(0, 150) || "Unknown error occurred"}`;
};

const visualMetadataSchema: ResponseSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, enum: ['desmos', 'jsxgraph'] },
        data: { type: Type.STRING, description: "Desmos: semicolon separated expressions. JSXGraph: Simplified construction instructions." }
    },
    required: ["type", "data"]
};

const mathStepSchema: ResponseSchema = {
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

const mathSolutionSchema: ResponseSchema = {
  type: Type.OBJECT,
  properties: {
    exerciseStatement: {
      type: Type.STRING,
      description: "Full text of the exercise. Use LaTeX ($...$) for EVERY number and variable.",
    },
    problemSummary: {
      type: Type.STRING,
      description: "Concise summary using LaTeX.",
    },
    steps: {
      type: Type.ARRAY,
      items: mathStepSchema,
    },
    finalAnswer: {
      type: Type.STRING,
      description: "Final result in LaTeX ($...$).",
    },
    visualMetadata: visualMetadataSchema
  },
  required: ["exerciseStatement", "problemSummary", "steps", "finalAnswer"],
};

const examPaperSchema: ResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    totalMarks: { type: Type.INTEGER },
    duration: { type: Type.INTEGER },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                number: { type: Type.STRING },
                marks: { type: Type.INTEGER },
                questionText: { type: Type.STRING },
                steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                markscheme: { type: Type.STRING },
                shortAnswer: { type: Type.STRING },
                hint: { type: Type.STRING },
                calculatorAllowed: { type: Type.BOOLEAN },
                visualMetadata: visualMetadataSchema
              },
              required: ["id", "number", "marks", "questionText", "markscheme", "shortAnswer", "calculatorAllowed", "steps"]
            }
          }
        },
        required: ["title", "questions"]
      }
    }
  },
  required: ["title", "totalMarks", "duration", "sections"]
};

const drillQuestionSchema: ResponseSchema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    difficultyLevel: { type: Type.NUMBER },
    questionText: { type: Type.STRING },
    shortAnswer: { type: Type.STRING },
    hint: { type: Type.STRING },
    calculatorAllowed: { type: Type.BOOLEAN },
    visualMetadata: visualMetadataSchema
  },
  required: ["topic", "difficultyLevel", "questionText", "shortAnswer", "hint", "calculatorAllowed"]
};

const drillSolutionSchema: ResponseSchema = {
    type: Type.OBJECT,
    properties: {
        steps: {
            type: Type.ARRAY,
            items: mathStepSchema
        }
    },
    required: ["steps"]
};

const conceptExplanationSchema: ResponseSchema = {
    type: Type.OBJECT,
    properties: {
        topicTitle: { type: Type.STRING },
        introduction: { type: Type.STRING },
        conceptBlocks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    keyEquation: { type: Type.STRING },
                    visualMetadata: visualMetadataSchema
                },
                required: ["title", "content"]
            }
        },
        coreFormulas: { type: Type.ARRAY, items: { type: Type.STRING } },
        examples: {
            type: Type.ARRAY,
            items: {
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
            }
        }
    },
    required: ["topicTitle", "introduction", "conceptBlocks", "examples"]
};

const exampleReloadSchema: ResponseSchema = {
    type: Type.ARRAY,
    items: {
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
    }
};

const questionValidationSchema: ResponseSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        number: { type: Type.STRING },
        marks: { type: Type.INTEGER },
        questionText: { type: Type.STRING },
        steps: { type: Type.ARRAY, items: { type: Type.STRING } },
        markscheme: { type: Type.STRING },
        shortAnswer: { type: Type.STRING },
        hint: { type: Type.STRING },
        calculatorAllowed: { type: Type.BOOLEAN },
        visualMetadata: visualMetadataSchema
    },
    required: ["id", "number", "marks", "questionText", "markscheme", "shortAnswer", "calculatorAllowed", "steps"]
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
    try {
        return await withTimeout(operation(), 60000); 
    } catch (error: any) {
        const msg = (error.message || "").toLowerCase();
        const status = error.status || 0;
        const isNetworkError = msg.includes('xhr error') || msg.includes('fetch failed') || msg.includes('network') || msg.includes('timed out') || error.code === 6;
        const isServerOrQuota = status === 429 || status >= 500 || msg.includes('429') || msg.includes('overloaded'); 
        if (retries > 0 && (isNetworkError || isServerOrQuota)) {
            await delay(delayMs);
            return retryOperation(operation, retries - 1, delayMs * 2);
        }
        throw new Error(mapGenAIError(error));
    }
};

const VISUAL_SYSTEM_PROMPT = `
CRITICAL VISUALIZATION RULES:
1. When the problem involves Functions, Vectors, Trigonometry, Parametric equations, or Calculus, generate 'visualMetadata' of type 'desmos'. The data field should contain semicolon separated Desmos expressions.
2. When the problem involves Euclidean geometry, geometric constructions, or composed figures, generate 'visualMetadata' of type 'jsxgraph'. The data field should be a list of commands like: "point:[0,0];circle:[[0,0],5];line:[[0,0],[5,5]]".
3. Use visual representations ONLY when they are truly required or helpful for the specific exercise type.
`;

export const runConnectivityTest = async (): Promise<boolean> => {
    const startTime = Date.now();
    const log = logRequest('gemini-3-flash-preview', 'TEST', 'TEST');
    try {
        await withTimeout(ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: 'Ping' }] }
        }), 10000); 
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return true;
    } catch (e: any) {
        const mappedMsg = mapGenAIError(e);
        updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
        throw new Error(mappedMsg);
    }
}

export const analyzeMathInput = async (input: UserInput): Promise<MathSolution> => {
  return retryOperation(async () => {
    const startTime = Date.now();
    // Use gemini-3-pro-preview for complex reasoning tasks like math solving
    const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'SOLVER');
    try {
        const isImage = input.type === 'image';
        const systemPrompt = `
        You are an expert IB Math tutor. 
        ${VISUAL_SYSTEM_PROMPT}
        CRITICAL FORMATTING RULES:
        1. ALL math, numbers, variables must be wrapped in LaTeX delimiters ($...$).
        2. Do NOT output plain text math.
        3. Break down solutions into clear, logical steps.
        `;
        const parts = isImage 
          ? [
              { inlineData: { data: input.content, mimeType: input.mimeType } },
              { text: `${systemPrompt}\nAnalyze this image. Transcribe exactly using LaTeX. Solve step-by-step.` }
            ]
          : [{ text: `${systemPrompt}\nSolve this problem: "${input.content}"` }];
        const response = await ai.models.generateContent({
          model: "gemini-3-pro-preview", 
          contents: { parts },
          config: { responseMimeType: "application/json", responseSchema: mathSolutionSchema as any },
        });
        const text = response.text;
        if (!text) throw new Error("Empty response from AI service.");
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return JSON.parse(text) as MathSolution;
      } catch (error: any) {
        const mappedMsg = mapGenAIError(error);
        updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
        throw new Error(mappedMsg);
      }
  });
};

export const generateExam = async (inputs: UserInput[], settings: ExamSettings): Promise<ExamPaper> => {
  return retryOperation(async () => {
    const startTime = Date.now();
    const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'EXAM');
    try {
        const parts: any[] = [];
        inputs.forEach(input => {
            if (input.type === 'image' || input.type === 'pdf') parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
            else parts.push({ text: `Source Material: ${input.content}` });
        });
        const prompt = `
          Create an IB Math Exam.
          ${VISUAL_SYSTEM_PROMPT}
          SETTINGS: Difficulty ${settings.difficulty}, Duration ${settings.durationMinutes} min, Topics ${settings.topics.join(', ') || "General"}
        `;
        parts.push({ text: prompt });
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts },
            config: { responseMimeType: "application/json", responseSchema: examPaperSchema as any, temperature: 0.7 },
        });
        const text = response.text;
        if (!text) throw new Error("AI returned empty content.");
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return JSON.parse(text) as ExamPaper;
    } catch (e: any) {
        const mappedMsg = mapGenAIError(e);
        updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
        throw new Error(mappedMsg);
    }
  });
};

export const generateDrillQuestion = async (settings: DrillSettings, inputs: UserInput[], questionNumber: number, prevDifficulty: number): Promise<DrillQuestion> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'DRILL');
        try {
            const parts: any[] = [];
            inputs.forEach(input => {
                if (input.type === 'image' || input.type === 'pdf') parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
                else parts.push({ text: `Context: ${input.content}` });
            });
            const prompt = `Generate Drill Question #${questionNumber}. ${VISUAL_SYSTEM_PROMPT} Difficulty ${prevDifficulty}/10. Topics: ${settings.topics.join(', ')}`;
            parts.push({ text: prompt });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview", 
                contents: { parts },
                config: { responseMimeType: "application/json", responseSchema: drillQuestionSchema as any, temperature: 0.8 },
            });
            const text = response.text;
            if (!text) throw new Error("AI returned empty content.");
            const q = JSON.parse(text) as DrillQuestion;
            q.number = questionNumber;
            q.difficultyLevel = prevDifficulty;
            updateLogStatus(log.id, 'SUCCESS', startTime);
            return q;
        } catch (e: any) {
            const mappedMsg = mapGenAIError(e);
            updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
            throw new Error(mappedMsg);
        }
    });
}

export const generateDrillBatch = async (startNum: number, prevDiff: number, count: number, settings: DrillSettings, inputs: UserInput[]): Promise<DrillQuestion[]> => {
    const promises = [];
    let currentDiff = prevDiff;
    for (let i = 0; i < count; i++) {
        promises.push(generateDrillQuestion(settings, inputs, startNum + i, currentDiff));
        currentDiff = Math.min(10, currentDiff + 0.5); 
    }
    const results = await Promise.allSettled(promises);
    return results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<DrillQuestion>).value);
}

export const generateDrillSolution = async (question: DrillQuestion): Promise<MathStep[]> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'DRILL');
        try {
            const prompt = `Solve Drill Question: ${question.questionText}. ${VISUAL_SYSTEM_PROMPT}`;
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json", responseSchema: drillSolutionSchema as any, temperature: 0.5 }
            });
            const text = response.text;
            if (!text) throw new Error("Failed to generate solution");
            updateLogStatus(log.id, 'SUCCESS', startTime);
            return JSON.parse(text).steps as MathStep[];
        } catch (e: any) {
            const mappedMsg = mapGenAIError(e);
            updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
            throw new Error(mappedMsg);
        }
    });
};

export const generateConceptExplanation = async (inputs: UserInput[], settings: ConceptSettings): Promise<ConceptExplanation> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'CONCEPT');
        try {
            const parts: any[] = [];
            inputs.forEach(input => {
                if (input.type === 'image' || input.type === 'pdf') parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
                else parts.push({ text: `User Query/Context: ${input.content}` });
            });
            const prompt = `
            Act as an elite IB Math AA HL Examiner.
            Task: Provide a high-precision explanation for: "${settings.topic}".
            ${VISUAL_SYSTEM_PROMPT}
            Settings: Level: ${settings.level}, Depth: ${settings.depth}
            `;
            parts.push({ text: prompt });
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: { parts },
                config: { responseMimeType: "application/json", responseSchema: conceptExplanationSchema as any, temperature: 0.4 }
            });
            const text = response.text;
            if (!text) throw new Error("Empty AI response");
            updateLogStatus(log.id, 'SUCCESS', startTime);
            return JSON.parse(text) as ConceptExplanation;
        } catch (e: any) {
            const mappedMsg = mapGenAIError(e);
            updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
            throw new Error(mappedMsg);
        }
    });
};

export const breakdownConceptBlock = async (blockContent: string, topic: string): Promise<string> => {
    const startTime = Date.now();
    const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'CONCEPT');
    try {
        const prompt = `Break down mathematical concept block into simpler points. Topic: ${topic} Content: "${blockContent}"`;
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "text/plain", temperature: 0.5 }
        });
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return response.text || "Breakdown unavailable.";
    } catch (e: any) {
        updateLogStatus(log.id, 'ERROR', startTime, e.message);
        return "Could not generate breakdown.";
    }
};

export const reloadConceptExamples = async (currentExplanation: ConceptExplanation): Promise<ConceptExample[]> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'CONCEPT');
        try {
            const prompt = `Generate 3 NEW IB Math examples for: "${currentExplanation.topicTitle}". ${VISUAL_SYSTEM_PROMPT}`;
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json", responseSchema: exampleReloadSchema as any, temperature: 0.7 }
            });
            const text = response.text;
            if (!text) throw new Error("Empty response");
            updateLogStatus(log.id, 'SUCCESS', startTime);
            return JSON.parse(text) as ConceptExample[];
        } catch (e: any) {
            updateLogStatus(log.id, 'ERROR', startTime, e.message);
            throw e;
        }
    });
};

export const createChatSession = (systemInstruction: string) => {
    try {
        logRequest('gemini-3-pro-preview', 'CHAT', 'CHAT'); 
        return ai.chats.create({
            model: "gemini-3-pro-preview",
            config: { systemInstruction }
        });
    } catch (e: any) {
        throw new Error(mapGenAIError(e));
    }
};

export const getStepHint = async (step: MathStep, context: string): Promise<string> => {
    const startTime = Date.now();
    const log = logRequest('gemini-3-pro-preview', 'CHAT', 'SOLVER');
    try {
        const response = await withTimeout(ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: `Hint for step: ${step.title}` }] }
        }), 20000) as GenerateContentResponse;
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return response.text || "Hint unavailable.";
    } catch (e: any) {
        updateLogStatus(log.id, 'ERROR', startTime, e.message);
        return "Try breaking this step down.";
    }
}

export const getStepBreakdown = async (step: MathStep, context: string): Promise<string[]> => {
    const startTime = Date.now();
    const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'SOLVER');
    try {
        const response = await withTimeout(ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: `Breakdown step: ${step.title}` }] },
             config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } as any
            }
        }), 25000) as GenerateContentResponse;
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return JSON.parse(response.text || "[]");
    } catch (e: any) {
        updateLogStatus(log.id, 'ERROR', startTime, e.message);
        return [];
    }
}

export const getMarkscheme = async (question: string, solution: string): Promise<string> => {
    const startTime = Date.now();
    const log = logRequest('gemini-3-pro-preview', 'GENERATE', 'SOLVER');
    try {
        const prompt = `expert IB Math Examiner. Detailed Markscheme for problem: ${question}. Ref Solution: ${solution}. STRICT Markdown Table. Columns: | Step | Working | Explanation | Marks |. Use standard codes: M1, A1, R1, AG.`;
        const response = await withTimeout(ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "text/plain", temperature: 0.2 }
        }), 30000) as GenerateContentResponse;
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return response.text || "";
    } catch (e: any) {
        updateLogStatus(log.id, 'ERROR', startTime, e.message);
        return "";
    }
}
