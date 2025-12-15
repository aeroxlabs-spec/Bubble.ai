
import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty, ConceptSettings, ConceptExplanation, ConceptExample } from "../types";
import { supabase, withTimeout } from "./supabaseClient";
import { authService } from "./authService";

// Module-level variable to store the active user key directly from AuthContext
let sessionKey: string | null = null;
let dailyRequestLimit = 50; // Default soft limit
let dailyRequestCount = 0;
let lifetimeRequestCount = 0; // New lifetime tracker

// Initialize daily count from local storage if available
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

    // Initialize lifetime count
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
    // Estimate token usage (rough avg 500 tokens in/out per request for calculation)
    estimatedCredits: lifetimeRequestCount * 5 
});

const incrementUsage = () => {
    dailyRequestCount++;
    lifetimeRequestCount++;
    localStorage.setItem('bubble_usage_count', dailyRequestCount.toString());
    localStorage.setItem('bubble_lifetime_count', lifetimeRequestCount.toString());
};

const checkUsageLimit = () => {
    // Only enforce soft limit for custom keys (optional behavior) or globally
    if (dailyRequestCount >= dailyRequestLimit) {
        console.warn(`Daily limit of ${dailyRequestLimit} requests reached.`);
    }
};

// --- DIAGNOSTICS & LOGGING SYSTEM ---
export interface ApiLog {
    id: string;
    timestamp: string;
    model: string;
    keyFingerprint: string;
    type: 'GENERATE' | 'CHAT' | 'TEST';
    status: 'PENDING' | 'SUCCESS' | 'ERROR';
    latency?: string;
    dbError?: string; // New field for DB errors
    errorMessage?: string; 
}

export interface SystemHealthReport {
    timestamp: number;
    checks: {
        network: boolean;
        database: boolean;
        apiKey: boolean;
        localStorage: boolean;
        dbKeyFound: boolean; // Is key in Supabase?
        keyMismatch: boolean; // Local vs DB mismatch?
    };
    userId: string | null;
    keyMode: 'CUSTOM' | 'CREDITS' | 'NONE';
    creditsBalance: number;
    latencyMs: number;
}

const apiLogs: ApiLog[] = [];

export const getRecentLogs = () => [...apiLogs].reverse().slice(0, 20);

// Updated logRequest to write to Supabase
const logRequest = (model: string, type: 'GENERATE' | 'CHAT' | 'TEST', appMode: string = 'UNKNOWN'): ApiLog => {
    incrementUsage();
    checkUsageLimit();
    
    const key = getApiKey();
    const fingerprint = key && key.length > 8 ? "..." + key.substring(key.length - 4) : "MISSING/INVALID";
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

    // Fire-and-forget logging to Supabase with timeout wrapper
    (async () => {
        try {
            const user = await authService.getCurrentUser();
            if (user && !user.id.startsWith('guest-')) {
                // Wrap in timeout so it doesn't hang background processes
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
    if (key && key.trim().length > 10) {
        sessionKey = key.trim();
    } else {
        sessionKey = null;
    }
};

// Helper to safely get API key - STRICT BYOK MODE
const getApiKey = () => {
    // 1. Check Explicit Session Key (From AuthContext) - Highest Priority
    if (sessionKey && sessionKey.trim().length > 10) {
        return sessionKey.trim();
    }

    // 2. Check LocalStorage (Persistence)
    if (typeof window !== 'undefined' && window.localStorage) {
        const localKey = localStorage.getItem('bubble_user_api_key');
        if (localKey && localKey.trim().length > 10) {
            return localKey.trim();
        }
    }
    
    return "";
};

export const getKeyFingerprint = () => {
    const key = getApiKey();
    if (!key || key.length < 8) return "None";
    return "..." + key.substring(key.length - 4);
}

export const getSystemDiagnostics = () => {
    const key = getApiKey();
    return {
        hasApiKey: !!key && key.length > 10,
        keyLength: key ? key.length : 0,
        keyPrefix: key ? key.substring(0, 4) + "..." : "N/A",
        envCheck: {
            sessionKey: !!sessionKey,
            localStorage: typeof window !== 'undefined' && !!localStorage.getItem('bubble_user_api_key'),
            vite: false, // Disabled
            process: false, // Disabled
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
        keyMode: 'NONE',
        creditsBalance: 0,
        latencyMs: 0
    };

    const activeKey = getApiKey();
    const localKey = typeof window !== 'undefined' ? localStorage.getItem('bubble_user_api_key') : null;

    // 1. Check Database (Supabase) and Key Consistency
    try {
        const user = await authService.getCurrentUser();
        if (user) {
            report.userId = user.id;
            // Check auth status
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Check KEY existence in Supabase (Lowercase table)
                const { data, error } = await withTimeout(supabase
                    .from('user_api_keys')
                    .select('encrypted_key')
                    .eq('user_id', user.id)
                    .eq('provider', 'gemini')
                    .maybeSingle(), 5000) as any;
                
                if (!error) {
                    report.checks.database = true;
                    if (data && data.encrypted_key) {
                        report.checks.dbKeyFound = true;
                        // Check for mismatch between Local and Cloud
                        if (localKey && data.encrypted_key !== localKey) {
                            report.checks.keyMismatch = true;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Diagnostic: DB Check Failed", e);
    }

    // 2. Check Key & Credits Mode
    const credits = parseInt(localStorage.getItem('bubble_credits') || '0', 10);
    report.creditsBalance = credits;

    const defaultKey = "AIzaSyAk4hc_GDCixtu5v7y2yrX4TpUL5Q1EAHc"; // Hardcoded known default
    
    if (activeKey) {
        if (activeKey === defaultKey) {
            report.keyMode = 'CREDITS';
        } else {
            report.keyMode = 'CUSTOM';
        }
    } else {
        report.keyMode = 'NONE';
    }

    // 3. Latency Ping (Actual API Call)
    if (activeKey) {
        try {
             const startPing = Date.now();
             const client = new GoogleGenAI({ apiKey: activeKey });
             await withTimeout(client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: 'Ping' }] }
             }), 10000);
             report.latencyMs = Date.now() - startPing;
             report.checks.apiKey = true;
        } catch (e) {
             console.error("Diagnostic: API Ping Failed", e);
             report.checks.apiKey = false;
        }
    }

    return report;
};

// Lazy initialization of the AI client
const getAiClient = () => {
    const apiKey = getApiKey();
    
    if (!apiKey || apiKey.length < 10) {
        return new GoogleGenAI({ apiKey: "MISSING_KEY" });
    } else {
        return new GoogleGenAI({ apiKey: apiKey });
    }
};

// Helper to validate client before use
const ensureClientReady = () => {
    const client = getAiClient();
    const apiKey = getApiKey();
    
    if (!apiKey || apiKey.length < 10 || (client as any).apiKey === "MISSING_KEY") {
        throw new Error(`API Key Missing. Please go to Settings and enter your Gemini API Key.`);
    }
    return client;
};

// --- ERROR MAPPING UTILITY ---
const mapGenAIError = (error: any): string => {
    const msg = error.message || "";
    const status = error.status || 0;

    if (msg.includes("Validation Failed")) return "Generated content was malformed. Retrying automatically...";
    if (msg.includes("Request timed out")) return "Request Timeout. The server took too long to respond.";
    if (msg.includes("API Key Missing")) return msg;
    if (msg.includes("400") || status === 400) return "Invalid Request (400). The image format might be unsupported or the prompt is too large.";
    if (msg.includes("401") || status === 401) return "Unauthorized (401). Your API Key is invalid. Please update it in Settings.";
    if (msg.includes("403") || status === 403) return "Permission Denied (403). Your API Key might be expired, or your billing project is inactive.";
    if (msg.includes("404") || status === 404) return "Model Not Found (404). Gemini 2.5 Flash may not be available in your region yet.";
    if (msg.includes("429") || status === 429) return "Rate Limit Exceeded (429). You are sending requests too fast. Please wait a moment.";
    if (msg.includes("500") || status === 500) return "Google Server Error (500). The AI service is currently down. Try again later.";
    if (msg.includes("503") || status === 503) return "Service Overloaded (503). Google's servers are busy.";
    if (msg.includes("fetch failed") || msg.includes("NetworkError")) return "Network Error. Please check your internet connection.";
    
    return `AI Error: ${msg.substring(0, 100)}...`;
};

// --- AUTOMATIC RESPONSE VALIDATOR ---
// This ensures we catch bad math syntax or hallucinated formats BEFORE showing to user
const validateResponse = (data: any, type: 'SOLUTION' | 'DRILL' | 'EXAM' | 'CONCEPT'): void => {
    const str = JSON.stringify(data);
    
    // 1. Check for LaTeX syntax errors
    // Look for unclosed $, or weird patterns like `[Math Processing Error]`
    if (str.includes("[Math Processing Error]") || str.includes("katex-error")) {
        throw new Error("Validation Failed: Detected LaTeX rendering error in output.");
    }

    // 2. Check for empty critical fields
    if (type === 'DRILL') {
        if (!data.questionText || data.questionText.length < 5) throw new Error("Validation Failed: Empty Question Text");
    }
};

// --- SCHEMAS ---

const mathStepSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        section: { type: Type.STRING },
        title: { type: Type.STRING },
        explanation: { type: Type.STRING },
        keyEquation: { type: Type.STRING }
    },
    required: ["section", "title", "explanation", "keyEquation"]
};

const geometryConfigSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        xmin: { type: Type.NUMBER },
        xmax: { type: Type.NUMBER },
        ymin: { type: Type.NUMBER },
        ymax: { type: Type.NUMBER },
        objects: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["point", "line", "segment", "vector", "circle", "angle", "polygon"] },
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    coords: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    parents: { type: Type.ARRAY, items: { type: Type.STRING } },
                    radius: { type: Type.NUMBER }
                },
                required: ["type", "id"]
            }
        }
    },
    required: ["xmin", "xmax", "ymin", "ymax", "objects"]
};

const mathSolutionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exerciseStatement: {
      type: Type.STRING,
      description: "The full text of the exercise. Use LaTeX ($...$).",
    },
    problemSummary: {
      type: Type.STRING,
      description: "A concise summary using LaTeX for all math.",
    },
    steps: {
      type: Type.ARRAY,
      items: mathStepSchema,
    },
    finalAnswer: {
      type: Type.STRING,
      description: "Final result. Use Markdown list format. Use LaTeX.",
    },
    graphFunctions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "If the solution involves functions that can be graphed, list them in JS syntax (e.g. 'x^2', 'Math.sin(x)'). If not relevant, return empty."
    },
    geometryConfig: geometryConfigSchema
  },
  required: ["exerciseStatement", "problemSummary", "steps", "finalAnswer"],
};

const examPaperSchema: Schema = {
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
                graphFunctions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "JS Math functions for plotting (e.g. 'x^3 - 2*x')."
                },
                geometryConfig: geometryConfigSchema
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

const drillQuestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    difficultyLevel: { type: Type.NUMBER },
    questionText: { type: Type.STRING },
    shortAnswer: { type: Type.STRING },
    hint: { type: Type.STRING },
    calculatorAllowed: { type: Type.BOOLEAN },
    graphFunctions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "JS Math syntax for interactive graphing if relevant."
    },
    geometryConfig: geometryConfigSchema
  },
  required: ["topic", "difficultyLevel", "questionText", "shortAnswer", "hint", "calculatorAllowed"]
};

const drillSolutionSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        steps: {
            type: Type.ARRAY,
            items: mathStepSchema,
            description: "Full Smart-Solver style step-by-step solution."
        }
    },
    required: ["steps"]
};

const conceptExplanationSchema: Schema = {
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
                    keyEquation: { type: Type.STRING }
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
                    graphFunctions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    geometryConfig: geometryConfigSchema
                },
                required: ["difficulty", "question", "hint", "solutionSteps", "finalAnswer", "explanation"]
            }
        }
    },
    required: ["topicTitle", "introduction", "conceptBlocks", "examples"]
};

const exampleReloadSchema: Schema = {
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
            graphFunctions: { type: Type.ARRAY, items: { type: Type.STRING } },
            geometryConfig: geometryConfigSchema
        },
        required: ["difficulty", "question", "hint", "solutionSteps", "finalAnswer", "explanation"]
    }
};

const questionValidationSchema: Schema = {
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
        graphFunctions: { type: Type.ARRAY, items: { type: Type.STRING } },
        geometryConfig: geometryConfigSchema
    },
    required: ["id", "number", "marks", "questionText", "markscheme", "shortAnswer", "calculatorAllowed", "steps"]
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
    try {
        // Wrap the operation call in withTimeout to ensure we don't hang indefinitely waiting for Gemini
        return await withTimeout(operation(), 60000); // 60s timeout for AI generation
    } catch (error: any) {
        const isNetworkError = 
            error.message?.includes('xhr error') || 
            error.message?.includes('fetch failed') ||
            error.message?.includes('network') ||
            error.message?.includes('timed out') ||
            error.code === 6;
            
        const isServerOrQuota = 
            error.status === 429 || 
            error.status >= 500 || 
            error.message?.includes('429') || 
            error.message?.includes('quota');
        
        const isValidationFail = error.message?.includes("Validation Failed");

        if (retries > 0 && (isNetworkError || isServerOrQuota || isValidationFail)) {
            console.warn(`Operation failed (${error.message}). Retrying... (${retries} left)`);
            await delay(delayMs);
            return retryOperation(operation, retries - 1, delayMs * 2);
        }
        // Throw mapped error immediately on final fail
        throw new Error(mapGenAIError(error));
    }
};

// --- CORE FUNCTIONS WITH LOGGING ---

export const runConnectivityTest = async (): Promise<boolean> => {
    const startTime = Date.now();
    const log = logRequest('gemini-2.5-flash', 'TEST', 'TEST');
    try {
        const client = ensureClientReady();
        await withTimeout(client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: 'Ping' }] }
        }), 10000); // 10s timeout for simple ping
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
    const log = logRequest('gemini-2.5-flash', 'GENERATE', 'SOLVER');
    try {
        const client = ensureClientReady();
        const isImage = input.type === 'image';
        
        const systemPrompt = `
        You are an expert IB Math tutor. 
        CRITICAL FORMATTING RULES:
        1. ALL math, numbers, variables must be wrapped in LaTeX delimiters ($...$). Do NOT output plain text math like 'x^2' without $ signs.
        2. Break down solutions into clear, logical steps.
        3. If a Markscheme is requested, it MUST be a Markdown Table.
        
        VISUALIZATION RULES (BALANCE):
        4. If the problem is specifically about Geometry, Vectors, or Trigonometry, provide a 'geometryConfig' object in roughly 50% of cases to visualize the problem.
        5. For the other 50% of cases (especially algebraic vectors/trig), DO NOT provide geometryConfig. Force the student to rely on algebraic understanding.
        6. For Functions, provide 'graphFunctions' (e.g. ["x^2", "Math.sin(x)"]) where helpful.
        7. Do NOT use non-standard HTML tags like <ln>, </ln>, <step>. Use standard Markdown.
        `;

        const parts = isImage 
          ? [
              {
                inlineData: {
                  data: input.content,
                  mimeType: input.mimeType,
                },
              },
              {
                text: `${systemPrompt}\nAnalyze this image. Transcribe the exercise exactly using LaTeX. Solve it step-by-step.`,
              },
            ]
          : [
              {
                text: `${systemPrompt}\nSolve this problem: "${input.content}"`,
              }
          ];
    
        const response = await client.models.generateContent({
          model: "gemini-2.5-flash", 
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            responseSchema: mathSolutionSchema,
          },
        });
    
        const text = response.text;
        if (!text) throw new Error("Empty response from AI service.");
        
        const data = JSON.parse(text);
        validateResponse(data, 'SOLUTION');

        updateLogStatus(log.id, 'SUCCESS', startTime);
        return data as MathSolution;
      } catch (error: any) {
        const mappedMsg = mapGenAIError(error);
        updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
        throw new Error(mappedMsg);
      }
  });
};

// NEW FUNCTION FOR SIMILAR PROBLEM GENERATION
export const generateSimilarProblem = async (originalContext: string): Promise<DrillQuestion> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-2.5-flash', 'GENERATE', 'DRILL');
        try {
            const client = ensureClientReady();
            const prompt = `
                Based on the following solved problem, generate a SIMILAR practice question to reinforce the method.
                Original Context: ${originalContext.substring(0, 1000)}...
                
                Requirements:
                1. Change numbers/functions but keep concept identical.
                2. Return a DrillQuestion object.
                3. BALANCED VISUALS: If topic is Vectors/Trig/Geometry, ensure a 50/50 chance of including a 'geometryConfig'. Do not make every question visual.
                4. ALL numbers and variables MUST be wrapped in LaTeX ($...$).
            `;

            const response = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: drillQuestionSchema,
                    temperature: 0.8
                }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response");
            
            const q = JSON.parse(text) as DrillQuestion;
            validateResponse(q, 'DRILL');

            q.number = 1; // Temporary number
            q.steps = [];
            
            updateLogStatus(log.id, 'SUCCESS', startTime);
            return q;
        } catch (e: any) {
            updateLogStatus(log.id, 'ERROR', startTime, e.message);
            throw e;
        }
    });
};

const reviewAndRefineQuestion = async (originalQ: any): Promise<any> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-2.5-flash', 'GENERATE', 'EXAM'); 
        try {
            const client = ensureClientReady();
            const prompt = `Review question logic and LaTeX syntax. Ensure valid 'graphFunctions' or 'geometryConfig' if visual needed. INPUT: ${JSON.stringify(originalQ)}`;
            
            const response = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: questionValidationSchema,
                    temperature: 0.3
                }
            });

            const text = response.text;
            updateLogStatus(log.id, 'SUCCESS', startTime);
            if (!text) return originalQ; 
            
            const parsed = JSON.parse(text);
            validateResponse(parsed, 'DRILL'); // Use Drill validator as it's similar question structure
            return parsed;
        } catch (e: any) {
            updateLogStatus(log.id, 'ERROR', startTime, e.message);
            throw e;
        }
    });
};

export const generateExam = async (inputs: UserInput[], settings: ExamSettings): Promise<ExamPaper> => {
  return retryOperation(async () => {
    const startTime = Date.now();
    const log = logRequest('gemini-2.5-flash', 'GENERATE', 'EXAM');
    try {
        const client = ensureClientReady();
        const parts: any[] = [];
        
        inputs.forEach(input => {
            if (input.type === 'image' || input.type === 'pdf') {
                parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
            } else {
                parts.push({ text: `Source Material: ${input.content}` });
            }
        });

        const prompt = `
          Create an IB Math Exam.
          SETTINGS: Difficulty ${settings.difficulty}, Duration ${settings.durationMinutes} min, Topics ${settings.topics.join(', ') || "General"}
          
          VISUAL RULES (STRICT BALANCE):
          - For Vectors, Geometry, and Trigonometry questions:
            * 50% MUST include a 'geometryConfig' for visualization.
            * 50% MUST NOT include any visualization (pure algebra/text).
          - For Functions:
            * 50% should include 'graphFunctions'.
            * 50% should be analytical only.
          
          PRE-FLIGHT CHECK:
          - Ensure ALL math, numbers (e.g. 5, 2.5), and variables (x, y) are wrapped in LaTeX: $5$, $2.5$, $x$.
        `;
        parts.push({ text: prompt });

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: examPaperSchema,
                temperature: 0.7 
            },
        });

        const text = response.text;
        if (!text) throw new Error("AI returned empty content.");
        const draftPaper = JSON.parse(text) as ExamPaper;

        // Use Promise.allSettled to prevent partial failures from crashing the whole exam generation
        const refinedSections = await Promise.all(draftPaper.sections.map(async (section) => {
            const results = await Promise.allSettled(section.questions.map(q => reviewAndRefineQuestion(q)));
            
            const refinedQuestions = results.map((result, idx) => {
                if (result.status === 'fulfilled') return result.value;
                console.error(`Question ${idx} refinement failed: ${result.reason}`);
                return section.questions[idx]; 
            });

            return { ...section, questions: refinedQuestions };
        }));

        updateLogStatus(log.id, 'SUCCESS', startTime);
        return { ...draftPaper, sections: refinedSections };
    } catch (e: any) {
        const mappedMsg = mapGenAIError(e);
        updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
        throw new Error(mappedMsg);
    }
  });
};

export const generateDrillQuestion = async (settings: DrillSettings, inputs: UserInput[], questionNumber: number, prevDifficulty: number, specificTopic?: string): Promise<DrillQuestion> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-2.5-flash', 'GENERATE', 'DRILL');
        try {
            const client = ensureClientReady();
            const parts: any[] = [];
            
            inputs.forEach(input => {
                if (input.type === 'image' || input.type === 'pdf') {
                    parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
                } else {
                    parts.push({ text: `Context: ${input.content}` });
                }
            });

            const topicToUse = specificTopic || settings.topics.join(', ');

            // Randomly decide if this question should be visual to enforce balance
            // This forces the LLM to adhere to our 50/50 rule over a session
            const forceVisual = Math.random() > 0.5;

            const prompt = `
                Generate Drill Question #${questionNumber}. 
                Difficulty ${prevDifficulty}/10. 
                Topic: ${topicToUse}. 
                
                VISUAL REQUIREMENT:
                ${forceVisual 
                    ? "- This question MUST have a visual representation (graphFunctions or geometryConfig)." 
                    : "- This question MUST be purely textual/algebraic (NO geometryConfig or graphFunctions)."}
                
                STRICT FORMATTING RULE:
                - EVERY number and variable MUST be in LaTeX.
                - BAD: "Solve for x when y = 5"
                - GOOD: "Solve for $x$ when $y = 5$"
            `;
            parts.push({ text: prompt });

            const response = await client.models.generateContent({
                model: "gemini-2.5-flash", 
                contents: { parts },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: drillQuestionSchema,
                    temperature: 0.8 
                },
            });

            const text = response.text;
            if (!text) throw new Error("AI returned empty content.");
            const q = JSON.parse(text) as DrillQuestion;
            validateResponse(q, 'DRILL');

            q.number = questionNumber;
            q.difficultyLevel = prevDifficulty;
            q.steps = []; 
            
            updateLogStatus(log.id, 'SUCCESS', startTime);
            return q;
        } catch (e: any) {
            const mappedMsg = mapGenAIError(e);
            updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
            throw new Error(mappedMsg);
        }
    });
}

// Helper to handle batch generation with allSettled
export const generateDrillBatch = async (startNum: number, prevDiff: number, count: number, settings: DrillSettings, inputs: UserInput[]): Promise<DrillQuestion[]> => {
    const promises = [];
    let currentDiff = prevDiff;
    const topics = settings.topics.length > 0 ? settings.topics : ["General Math"]; // Fallback

    for (let i = 0; i < count; i++) {
        // Rotate through selected topics to ensure mix
        const topicIndex = (startNum + i) % topics.length;
        const topic = topics[topicIndex];
        
        promises.push(generateDrillQuestion(settings, inputs, startNum + i, currentDiff, topic));
        currentDiff = Math.min(10, currentDiff + 0.5); 
    }
    
    // Avoid Promise.all to prevent single failure from killing batch
    const results = await Promise.allSettled(promises);
    
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<DrillQuestion>).value);
}

export const generateDrillSolution = async (question: DrillQuestion): Promise<MathStep[]> => {
    return retryOperation(async () => {
        const startTime = Date.now();
        const log = logRequest('gemini-2.5-flash', 'GENERATE', 'DRILL');
        try {
            const client = ensureClientReady();
            const prompt = `Solve Drill Question: ${question.questionText}`;
            
            const response = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: drillSolutionSchema,
                    temperature: 0.5 
                }
            });

            const text = response.text;
            if (!text) throw new Error("Failed to generate solution");
            const result = JSON.parse(text);
            updateLogStatus(log.id, 'SUCCESS', startTime);
            return result.steps as MathStep[];
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
        const log = logRequest('gemini-2.5-flash', 'GENERATE', 'CONCEPT');
        try {
            const client = ensureClientReady();
            const parts: any[] = [];

            inputs.forEach(input => {
                if (input.type === 'image' || input.type === 'pdf') {
                    parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
                } else {
                    parts.push({ text: `User Query/Context: ${input.content}` });
                }
            });

            const prompt = `
            Act as an expert IB Math Tutor.
            Explain the concept: "${settings.topic}".
            Target Level: ${settings.level}
            Depth: ${settings.depth}
            
            CRITICAL RULES:
            1. CONTENT: Be methodological, theoretical, and concise. Avoid flowery metaphors.
            2. FORMATTING: Use LaTeX ($...$) for ALL math.
            3. EXAMPLES: Provide exactly 3 examples (BASIC, EXAM, HARD).
            4. VISUALS: Ensure at least one example has a relevant visual aid (graph or geometryConfig).
            
            STRUCTURE:
            1. Introduction: Short, concise definition.
            2. ConceptBlocks: Array of logical steps/parts of the theory.
            3. Core Formulas: List of key equations.
            4. Examples: 3 IB style questions with solution steps and optional visuals.
            `;
            parts.push({ text: prompt });

            const response = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: conceptExplanationSchema,
                    temperature: 0.4 
                }
            });

            const text = response.text;
            if (!text) throw new Error("Empty AI response");
            
            const data = JSON.parse(text) as ConceptExplanation;
            validateResponse(data, 'CONCEPT');

            updateLogStatus(log.id, 'SUCCESS', startTime);
            return data;
        } catch (e: any) {
            const mappedMsg = mapGenAIError(e);
            updateLogStatus(log.id, 'ERROR', startTime, mappedMsg);
            throw new Error(mappedMsg);
        }
    });
};

export const breakdownConceptBlock = async (blockContent: string, topic: string): Promise<string> => {
    const startTime = Date.now();
    const log = logRequest('gemini-2.5-flash', 'GENERATE', 'CONCEPT');
    try {
        const client = ensureClientReady();
        const prompt = `
            Break down the following mathematical concept block into simpler, atomic points.
            Topic: ${topic}
            Content: "${blockContent}"
            
            Output: A bulleted list or short sentences explaining the "why" and "how" of this specific block.
            Use LaTeX for math. Keep it concise.
        `;

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "text/plain",
                temperature: 0.5
            }
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
        const log = logRequest('gemini-2.5-flash', 'GENERATE', 'CONCEPT');
        try {
            const client = ensureClientReady();
            const prompt = `
                Generate 3 NEW IB Math examples for the topic: "${currentExplanation.topicTitle}".
                Levels: 1 Basic, 1 Exam-Style, 1 Hard (7-level).
                Previous Examples Context (Do NOT repeat): ${currentExplanation.examples.map(e => e.question).join(' | ')}
                Include graphFunctions or geometryConfig where applicable.
                
                Format: JSON Array of 3 Example Objects.
            `;

            const response = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: exampleReloadSchema,
                    temperature: 0.7
                }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response");
            
            const data = JSON.parse(text) as ConceptExample[];
            // Basic validation
            if (!Array.isArray(data) || data.length === 0) throw new Error("Validation Failed: Empty Example Array");

            updateLogStatus(log.id, 'SUCCESS', startTime);
            return data;
        } catch (e: any) {
            updateLogStatus(log.id, 'ERROR', startTime, e.message);
            throw e;
        }
    });
};

export const createChatSession = (systemInstruction: string) => {
    try {
        const client = ensureClientReady();
        logRequest('gemini-2.5-flash', 'CHAT', 'CHAT'); 
        return client.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction
            }
        });
    } catch (e: any) {
        throw new Error(mapGenAIError(e));
    }
};

export const getStepHint = async (step: MathStep, context: string): Promise<string> => {
    const startTime = Date.now();
    const log = logRequest('gemini-2.5-flash', 'CHAT', 'SOLVER');
    try {
        const client = ensureClientReady();
        const response = await withTimeout(client.models.generateContent({
            model: "gemini-2.5-flash",
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
    const log = logRequest('gemini-2.5-flash', 'GENERATE', 'SOLVER');
    try {
        const client = ensureClientReady();
        const response = await withTimeout(client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: `Breakdown step: ${step.title}` }] },
             config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
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
    const log = logRequest('gemini-2.5-flash', 'GENERATE', 'SOLVER');
    try {
        const client = ensureClientReady();
        
        const prompt = `
            You are an expert IB Math Examiner. Create a detailed Markscheme for the following problem.
            
            RULES:
            1. Output MUST be a single Markdown Table.
            2. Columns: | Step | Working | Explanation | Marks |
            3. Use standard IB codes: M1 (Method), A1 (Accuracy), R1 (Reasoning), AG (Answer Given).
            4. Do not include any text outside the table (no intro/outro).
            5. Use LaTeX ($...$) for all math expressions.

            Problem: ${question}
            Reference Solution Steps: ${solution}
        `;

        const response = await withTimeout(client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "text/plain",
                temperature: 0.2
            }
        }), 30000) as GenerateContentResponse;
        updateLogStatus(log.id, 'SUCCESS', startTime);
        return response.text || "";
    } catch (e: any) {
        updateLogStatus(log.id, 'ERROR', startTime, e.message);
        return "";
    }
}
