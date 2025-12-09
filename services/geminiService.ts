
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty } from "../types";

// Helper to safely get API key with exhaustive checks for various build environments
const getApiKey = () => {
    let key = "";

    // 1. Check for standard API_KEY (Node/Process) - Priority for Backend/Direct
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.API_KEY) key = process.env.API_KEY;
        else if (process.env.REACT_APP_API_KEY) key = process.env.REACT_APP_API_KEY;
        else if (process.env.VITE_API_KEY) key = process.env.VITE_API_KEY;
        // Next.js
        else if (process.env.NEXT_PUBLIC_API_KEY) key = process.env.NEXT_PUBLIC_API_KEY;
    }

    // 2. Check for Vite-specific import.meta.env (Frontend)
    if (!key) {
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                // @ts-ignore
                if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
                // @ts-ignore
                else if (import.meta.env.API_KEY) key = import.meta.env.API_KEY;
                 // @ts-ignore
                else if (import.meta.env.REACT_APP_API_KEY) key = import.meta.env.REACT_APP_API_KEY;
            }
        } catch(e) {}
    }

    return key;
};

export const getSystemDiagnostics = () => {
    const key = getApiKey();
    return {
        hasApiKey: !!key && key.length > 10,
        keyLength: key ? key.length : 0,
        keyPrefix: key ? key.substring(0, 4) + "..." : "N/A",
        envCheck: {
            vite: typeof import.meta !== 'undefined' && !!(import.meta as any).env?.VITE_API_KEY,
            process: typeof process !== 'undefined' && !!process.env?.VITE_API_KEY,
        }
    }
};

// Lazy initialization of the AI client
let aiInstance: GoogleGenAI | null = null;

const getAiClient = () => {
    if (!aiInstance) {
        const apiKey = getApiKey();
        // Check for empty or placeholder keys
        if (!apiKey || apiKey.includes("your_api_key") || apiKey.length < 10) {
            console.warn("Gemini API Key is missing or invalid.");
            // Return a dummy client that will fail gracefully when called
            aiInstance = new GoogleGenAI({ apiKey: "MISSING_KEY" });
        } else {
            aiInstance = new GoogleGenAI({ apiKey: apiKey });
        }
    }
    return aiInstance;
};

// Helper to validate client before use
const ensureClientReady = () => {
    const client = getAiClient();
    const apiKey = getApiKey();
    
    if (!apiKey || apiKey.length < 10 || (client as any).apiKey === "MISSING_KEY") {
        throw new Error(`API Key Config Error. Status: ${apiKey ? 'Invalid' : 'Missing'}. Please ensure VITE_API_KEY is set in Vercel/Netlify Environment Variables.`);
    }
    return client;
};

const mathSolutionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exerciseStatement: {
      type: Type.STRING,
      description: "The full text of the exercise. CRITICAL: Use LaTeX ($...$) for EVERY number, variable, and expression. Example: write '$3$' not '3', write '$x$' not 'x'. Do NOT output plain text math.",
    },
    problemSummary: {
      type: Type.STRING,
      description: "A concise summary using LaTeX for all math.",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: {
            type: Type.STRING,
            description: "Section name (e.g., 'Part (a)').",
          },
          title: {
            type: Type.STRING,
            description: "Step title. Use LaTeX ($...$) for math.",
          },
          explanation: {
            type: Type.STRING,
            description: "Explanation. Highlight 1-2 keywords with **bold**. Use LaTeX ($...$) for ALL math terms.",
          },
          keyEquation: {
            type: Type.STRING,
            description: "The core equation in LaTeX (without $ delimiters).",
          },
        },
        required: ["section", "title", "explanation", "keyEquation"],
      },
    },
    finalAnswer: {
      type: Type.STRING,
      description: "Final result. CRITICAL: 1. Use Markdown list format. 2. Separate parts (a), (b) with double newlines (\\n\\n). 3. Use LaTeX ($...$) for ALL math. 4. NO marks ([4]).",
    },
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
                questionText: { 
                    type: Type.STRING, 
                    description: "Question text. CRITICAL: Use LaTeX ($...$) for EVERY number and variable. Separate parts with \\n\\n. Marks at end like **[4]**." 
                },
                steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Simplified solution steps in LaTeX ($...$)."
                },
                markscheme: { 
                    type: Type.STRING, 
                    description: "STRICT Markdown Table: | Step | Working | Explanation | Marks |. Rows separated by newline. Marks (M1, A1) in last column. Use LaTeX ($...$) for all math." 
                },
                shortAnswer: { 
                    type: Type.STRING, 
                    description: "Final Answer in LaTeX. CRITICAL: Separate parts with \\n\\n. Example: '(a) $x=1$ \\n\\n (b) $y=2$'. Use LaTeX ($...$) for all math." 
                },
                hint: { type: Type.STRING },
                calculatorAllowed: { type: Type.BOOLEAN },
                graphSvg: { type: Type.STRING }
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
    questionText: { 
        type: Type.STRING, 
        description: "Question text. STRICT RULES: 1. Use LaTeX ($...$) for ALL numbers/math. 2. Separate parts with \\n\\n. 3. NO marks shown." 
    },
    shortAnswer: { 
        type: Type.STRING, 
        description: "Answer. STRICT RULES: 1. Use LaTeX ($...$) for ALL math. 2. Separate parts with \\n\\n. 3. Format: '(a) $x=...$ \\n\\n (b) $y=...$'." 
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: { type: Type.STRING },
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          keyEquation: { type: Type.STRING },
        },
        required: ["section", "title", "explanation", "keyEquation"],
      },
    },
    hint: { type: Type.STRING },
    calculatorAllowed: { type: Type.BOOLEAN }
  },
  required: ["topic", "difficultyLevel", "questionText", "shortAnswer", "steps", "hint", "calculatorAllowed"]
};


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        const isNetworkError = 
            error.message?.includes('xhr error') || 
            error.message?.includes('fetch failed') ||
            error.message?.includes('network') ||
            error.code === 6;
            
        const isServerOrQuota = 
            error.status === 429 || 
            error.status >= 500 || 
            error.message?.includes('429') || 
            error.message?.includes('quota');

        if (retries > 0 && (isNetworkError || isServerOrQuota)) {
            console.warn(`Operation failed. Retrying... (${retries} left)`);
            await delay(delayMs);
            return retryOperation(operation, retries - 1, delayMs * 2);
        }
        throw error;
    }
};

export const analyzeMathInput = async (input: UserInput): Promise<MathSolution> => {
  return retryOperation(async () => {
    try {
        const client = ensureClientReady();
        const isImage = input.type === 'image';
        
        const systemPrompt = `
        You are an expert IB Math AA HL tutor. 
        CRITICAL FORMATTING RULES:
        1. ALL math, numbers, variables must be wrapped in LaTeX delimiters ($...$).
           - BAD: x = 3, sin(x), 45 degrees
           - GOOD: $x = 3$, $\\sin(x)$, $45^\\circ$
        2. Do NOT output plain text math.
        3. Break down solutions into clear, logical steps.
        4. If a Markscheme is requested or implied, it MUST be a Markdown Table:
           | Step | Working | Explanation | Marks |
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
        if (!text) throw new Error("No response text from Gemini");
        
        return JSON.parse(text) as MathSolution;
      } catch (error) {
        console.error("Error analyzing math input:", error);
        throw error;
      }
  });
};

export const generateExam = async (inputs: UserInput[], settings: ExamSettings): Promise<ExamPaper> => {
  return retryOperation(async () => {
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
      Create an IB Math AA HL Exam.
      
      SETTINGS:
      - Difficulty: ${settings.difficulty}
      - Duration: ${settings.durationMinutes} min
      - Topics: ${settings.topics.join(', ') || "General"}

      CRITICAL FORMATTING RULES (STRICT ENFORCEMENT):
      1. ALL numbers, variables, and math must be in LaTeX ($...$).
         - BAD: "Find x when y is 3"
         - GOOD: "Find $x$ when $y$ is $3$"
      2. Markscheme MUST be a Markdown Table:
         | Step | Working | Explanation | Marks |
         - M1, A1, R1 codes in the 'Marks' column ONLY.
      3. Short Answer:
         - Separate parts (a), (b) with double newlines (\\n\\n).
         - Use LaTeX for the answer.
      4. Do NOT output plain text for math symbols.
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
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as ExamPaper;
  });
};

export const generateDrillQuestion = async (settings: DrillSettings, inputs: UserInput[], questionNumber: number, prevDifficulty: number): Promise<DrillQuestion> => {
    return retryOperation(async () => {
        const client = ensureClientReady();
        const parts: any[] = [];
        
        inputs.forEach(input => {
             if (input.type === 'image' || input.type === 'pdf') {
                parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
            } else {
                parts.push({ text: `Context Material: ${input.content}` });
            }
        });

        // Dynamic difficulty adjustment
        let targetDifficulty = prevDifficulty === 0 ? 5 : prevDifficulty;
        if (questionNumber > 1) {
            targetDifficulty = Math.min(10, targetDifficulty + 0.5); 
        }

        const prompt = `
        Generate Drill Question #${questionNumber} (IB Math AA HL).
        
        SETTINGS:
        - Difficulty: ${targetDifficulty}/10
        - Topics: ${settings.topics.join(', ') || "Mixed"}
        
        STRICT FORMATTING RULES:
        1. ALL math/numbers must be LaTeX ($...$). No plain text numbers.
        2. Question Text:
           - Separate parts with double newlines (\\n\\n).
           - NO marks indicated.
        3. Short Answer:
           - Separate parts with double newlines (\\n\\n).
           - LaTeX only.
        4. Steps:
           - Smart Solver style (detailed, structured).
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
        if (!text) throw new Error("No response");
        const q = JSON.parse(text) as DrillQuestion;
        
        q.number = questionNumber;
        q.difficultyLevel = targetDifficulty;
        return q;
    });
}

export const getStepHint = async (step: MathStep, context: string): Promise<string> => {
    try {
        const client = ensureClientReady();
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [{ text: `
                    Context: ${context}
                    Current Step: ${step.title} - ${step.explanation}
                    Equation: ${step.keyEquation}
                    
                    Task: Provide a hint. Use LaTeX ($...$) for all math.
                `}]
            }
        });
        return response.text || "Review the formula booklet.";
    } catch (e) {
        return "Try breaking this step down further.";
    }
}

export const getStepBreakdown = async (step: MathStep, context: string): Promise<string[]> => {
    try {
        const client = ensureClientReady();
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [{ text: `
                    Context: ${context}
                    Step: ${step.title}
                    Equation: ${step.keyEquation}
                    
                    Task: Break down into 3-4 sub-steps. Use LaTeX ($...$) for all math.
                    Output JSON array of strings.
                `}]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return ["Analyze terms.", "Simplify expression."];
    }
}

export const getMarkscheme = async (question: string, solution: string): Promise<string> => {
    try {
        const client = ensureClientReady();
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [{ text: `
                    Question: ${question}
                    Solution Steps: ${solution}

                    Task: Convert this into a strict IB Markdown Markscheme Table.
                    Columns: | Step | Working | Explanation | Marks |
                    Rules:
                    1. Use M1, A1, R1, AG codes in the 'Marks' column.
                    2. Use LaTeX ($...$) for ALL math and numbers in 'Working' column.
                    3. No newlines inside table cells.
                `}]
            }
        });
        return response.text || "";
    } catch (e) {
        return "";
    }
}

export const createChatSession = (systemInstruction: string) => {
    const client = ensureClientReady();
    return client.chats.create({
        model: "gemini-2.5-flash",
        config: {
            systemInstruction
        }
    });
};
