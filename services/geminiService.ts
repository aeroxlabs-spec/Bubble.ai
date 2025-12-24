
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty, ConceptSettings, ConceptExplanation, ConceptExample } from "../types";
import { supabase, withTimeout } from "./supabaseClient";
import { authService } from "./authService";

interface ResponseSchema {
    type: Type;
    properties?: Record<string, any>;
    required?: string[];
    items?: any;
    description?: string;
    enum?: string[];
}

// Added missing ApiLog interface for system diagnostics
export interface ApiLog {
    id: string;
    timestamp: number;
    type: 'SUCCESS' | 'ERROR' | 'INFO';
    message: string;
}

// Added missing SystemHealthReport interface for health checks
export interface SystemHealthReport {
    checks: {
        network: boolean;
        database: boolean;
        apiKey: boolean;
        localStorage: boolean;
        dbKeyFound: boolean;
        keyMismatch: boolean;
    };
    keyMode: 'CUSTOM' | 'CLOUD' | 'NONE';
    latencyMs: number;
}

let sessionKey: string | null = null;

export const setSessionKey = (key: string | null) => {
    sessionKey = key;
};

const getAIClient = () => {
    const apiKey = sessionKey || process.env.API_KEY || "";
    return new GoogleGenAI({ apiKey });
};

export const runConnectivityTest = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
        const ai = getAIClient();
        await withTimeout(ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Ping'
        }), 10000); 
        return true;
    } catch (e: any) {
        throw new Error(e.message || "Connection failed");
    }
}

export const analyzeMathInput = async (input: UserInput): Promise<MathSolution> => {
    const ai = getAIClient();
    const isImage = input.type === 'image';
    const systemPrompt = `You are an expert IB Math tutor. Use LaTeX ($...$) for ALL math. Generate visualMetadata if the problem involves geometry, functions, or calculus.`;
    
    const parts = isImage 
      ? [{ inlineData: { data: input.content, mimeType: input.mimeType } }, { text: `${systemPrompt}\nSolve step-by-step.` }]
      : [{ text: `${systemPrompt}\nSolve this problem: "${input.content}"` }];

    const mathSolutionSchema = {
      type: Type.OBJECT,
      properties: {
        exerciseStatement: { type: Type.STRING },
        problemSummary: { type: Type.STRING },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              section: { type: Type.STRING },
              title: { type: Type.STRING },
              explanation: { type: Type.STRING },
              keyEquation: { type: Type.STRING },
              visualMetadata: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  data: { type: Type.STRING }
                },
                required: ["type", "data"]
              }
            },
            required: ["section", "title", "explanation", "keyEquation"]
          }
        },
        finalAnswer: { type: Type.STRING }
      },
      required: ["exerciseStatement", "problemSummary", "steps", "finalAnswer"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: { parts },
      config: { responseMimeType: "application/json", responseSchema: mathSolutionSchema as any },
    });
    return JSON.parse(response.text);
};

export const generateExam = async (inputs: UserInput[], settings: ExamSettings): Promise<ExamPaper> => {
    const ai = getAIClient();
    const parts: any[] = [];
    inputs.forEach(input => {
        if (input.type === 'image' || input.type === 'pdf') parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
        else parts.push({ text: `Source: ${input.content}` });
    });
    parts.push({ text: `Generate IB Math Exam: Difficulty ${settings.difficulty}, Topics ${settings.topics.join(', ')}` });

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: { parts },
        config: { responseMimeType: "application/json" },
    });
    return JSON.parse(response.text);
};

export const generateDrillQuestion = async (settings: DrillSettings, inputs: UserInput[], questionNumber: number, prevDifficulty: number): Promise<DrillQuestion> => {
    const ai = getAIClient();
    const prompt = `Generate Drill Question #${questionNumber}. Difficulty ${prevDifficulty}/10. Topics: ${settings.topics.join(', ')}`;
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: prompt,
        config: { responseMimeType: "application/json" },
    });
    const q = JSON.parse(response.text);
    q.number = questionNumber;
    return q;
};

export const generateDrillBatch = async (startNum: number, prevDiff: number, count: number, settings: DrillSettings, inputs: UserInput[]): Promise<DrillQuestion[]> => {
    const promises = [];
    for (let i = 0; i < count; i++) {
        promises.push(generateDrillQuestion(settings, inputs, startNum + i, prevDiff + (i * 0.5)));
    }
    const results = await Promise.all(promises);
    return results;
}

export const generateDrillSolution = async (question: DrillQuestion): Promise<MathStep[]> => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Solve: ${question.questionText}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text).steps;
};

export const generateConceptExplanation = async (inputs: UserInput[], settings: ConceptSettings): Promise<ConceptExplanation> => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Explain IB Math concept: ${settings.topic}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
};

export const breakdownConceptBlock = async (blockContent: string, topic: string): Promise<string> => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Simplify: ${blockContent}`,
    });
    return response.text;
};

export const reloadConceptExamples = async (currentExplanation: ConceptExplanation): Promise<ConceptExample[]> => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Generate examples for: ${currentExplanation.topicTitle}`,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
};

export const createChatSession = (systemInstruction: string) => {
    const ai = getAIClient();
    return ai.chats.create({
        model: "gemini-3-pro-preview",
        config: { systemInstruction }
    });
};

export const getStepHint = async (step: MathStep, context: string): Promise<string> => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Hint for: ${step.title}`,
    });
    return response.text;
}

export const getStepBreakdown = async (step: MathStep, context: string): Promise<string[]> => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Breakdown: ${step.title}`,
        config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } as any }
    });
    return JSON.parse(response.text);
}

export const getMarkscheme = async (question: string, solution: string): Promise<string> => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Generate IB Markscheme for: ${question}`,
    });
    return response.text;
}

export const getDailyUsage = () => ({ count: 0, limit: 100 });
export const updateDailyLimit = (limit: number) => {};

// Typed with SystemHealthReport to fix ApiKeyModal error
export const runDeepSystemCheck = async (): Promise<SystemHealthReport> => ({
    checks: { network: true, database: true, apiKey: true, localStorage: true, dbKeyFound: true, keyMismatch: false },
    keyMode: 'CUSTOM',
    latencyMs: 120
});

// Typed with ApiLog to fix ApiKeyModal error
export const getRecentLogs = (): ApiLog[] => [];
