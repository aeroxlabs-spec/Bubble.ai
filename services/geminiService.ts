import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty } from "../types";

// Helper to safely get API key without crashing
const getApiKey = () => {
    // 1. Priority: Vite/Netlify/Vercel standard (Must be prefixed with VITE_)
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) {
            // @ts-ignore
            return import.meta.env.VITE_API_KEY;
        }
    } catch(e) {}

    // 2. Fallback: Next.js / Vercel alternative convention
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_API_KEY) {
            // @ts-ignore
            return import.meta.env.NEXT_PUBLIC_API_KEY;
        }
    } catch(e) {}

    // 3. Fallback: Check for non-prefixed (if manually configured in vite config)
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env?.API_KEY) {
            // @ts-ignore
            return import.meta.env.API_KEY;
        }
    } catch(e) {}

    // 4. Fallback: Node process (local dev or polyfilled)
    try {
        if (typeof process !== 'undefined' && process.env?.API_KEY) {
            return process.env.API_KEY;
        }
    } catch(e) {}

    return "";
};

// Lazy initialization of the AI client
let aiInstance: GoogleGenAI | null = null;

const getAiClient = () => {
    if (!aiInstance) {
        const apiKey = getApiKey();
        if (!apiKey || apiKey.includes("your_api_key")) {
            console.warn("Gemini API Key is missing or invalid.");
            // We allow returning a client with a dummy key to prevent crash on load,
            // but we tag it so we can throw a clear error when used.
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
    if (getApiKey() === "" || (client as any).apiKey === "MISSING_KEY") {
        throw new Error("API Key missing. Please set VITE_API_KEY in your Vercel/Netlify settings and Redeploy.");
    }
    return client;
};

const mathSolutionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exerciseStatement: {
      type: Type.STRING,
      description: "The full, coherent text of the exercise. CRITICAL: Use LaTeX wrapped in $ symbols for ALL math expressions (e.g. 'Find $f(x)$ where $x > 0$'). If the image text is messy, reconstruct it into perfect English sentences. Do not output fragmented letters.",
    },
    problemSummary: {
      type: Type.STRING,
      description: "A concise summary of the math problem identified in the image.",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: {
            type: Type.STRING,
            description: "The section of the problem this step belongs to (e.g., 'Part (a)', 'Part (b)', 'Section 1'). Use 'Solution' if there are no parts.",
          },
          title: {
            type: Type.STRING,
            description: "A short title for this step (e.g., 'Find the derivative').",
          },
          explanation: {
            type: Type.STRING,
            description: "A VERY CONCISE explanation. Short sentences. Highlight ONLY 1-2 keywords per step using **bold**. DO NOT highlight entire phrases.",
          },
          keyEquation: {
            type: Type.STRING,
            description: "The primary mathematical result or equation for this step in LaTeX format (without $ delimiters).",
          },
        },
        required: ["section", "title", "explanation", "keyEquation"],
      },
    },
    finalAnswer: {
      type: Type.STRING,
      description: "The final result. Rules: 1. Format as a Markdown list. 2. Use **(a)**, **(b)** style for part labels (this makes them blue). 3. Do NOT bold the mathematical answer itself (keep it plain LaTeX). 4. Do NOT include any marks (e.g. [4]) in this field. 5. Use LaTeX $...$ for math.",
    },
  },
  required: ["exerciseStatement", "problemSummary", "steps", "finalAnswer"],
};

const examPaperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title (e.g. 'Calculus Mock')" },
    totalMarks: { type: Type.INTEGER },
    duration: { type: Type.INTEGER },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Section Name" },
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
                    description: "Question Text. IMPORTANT: 1. Put the General Exercise Statement first. 2. Use a DOUBLE NEWLINE (\\n\\n) to separate the statement from parts. 3. Each part (a, b...) must also be separated by \\n\\n. 4. Put marks at the end of parts like **[4]**. 5. Use LaTeX $...$." 
                },
                steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "3-5 bullet points on how to solve this. CRITICAL: WRAP ALL NUMBERS AND MATH IN LATEX ($...$). Do not use plain text numbers."
                },
                markscheme: { 
                    type: Type.STRING, 
                    description: "Strict Markdown Table string. Columns: | Step | Working | Explanation | Marks |. CRITICAL: 1. Do NOT use newlines inside a cell. Keep each row on a SINGLE line. 2. Marks (M1, A1) MUST be in the last column ONLY. 3. To separate multiple marks, just use a SPACE (e.g. 'M1 A1'). Do NOT use <br> or HTML tags. 4. Never return the string 'null'." 
                },
                shortAnswer: { 
                    type: Type.STRING, 
                    description: "Short answer in LaTeX. CRITICAL: 1. Separate each part with DOUBLE NEWLINES (\\n\\n). 2. ONLY use LaTeX for math (e.g. $x=5$). DO NOT write the plain text version next to it. DO NOT output 'null'. DO NOT output duplicate info. DO NOT output the plain text explanation next to the math. DO NOT output 'x > 0 (x is greater than 0)'." 
                },
                hint: { type: Type.STRING, description: "One sentence hint" },
                calculatorAllowed: { type: Type.BOOLEAN },
                graphSvg: { type: Type.STRING, description: "Optional SVG string for high-precision graph questions if absolutely necessary. Viewbox 0 0 400 400. White stroke, black background. Use <text> tags for labels. Draw axes clearly." }
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
    topic: { type: Type.STRING, description: "The specific topic this question covers (e.g. 'Chain Rule')." },
    difficultyLevel: { type: Type.NUMBER, description: "Difficulty level on a scale of 1-10." },
    questionText: { 
        type: Type.STRING, 
        description: "The full question. STRICT FORMATTING: 1. Start with the preamble/setup text. 2. Use DOUBLE NEWLINES (\\n\\n) to separate the preamble from Part (a). 3. Use DOUBLE NEWLINES between all parts. 4. CRITICAL: Do NOT include marks (e.g. [4]) in the question text. 5. CRITICAL: Use LaTeX ($...$) for ALL math expressions and numbers." 
    },
    shortAnswer: { 
        type: Type.STRING, 
        description: "The final answer. CRITICAL FORMATTING: 1. Use strict LaTeX ($...$) for math. 2. SEPARATE EACH PART WITH DOUBLE NEWLINES (\\n\\n) so they appear on separate lines. Example: '(a) $x = 5$ \\n\\n (b) $y = 10$'." 
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: { type: Type.STRING, description: "Part (a), etc." },
          title: { type: Type.STRING, description: "Short title for this step." },
          explanation: { type: Type.STRING, description: "Concise explanation." },
          keyEquation: { type: Type.STRING, description: "LaTeX result." },
        },
        required: ["section", "title", "explanation", "keyEquation"],
      },
      description: "Detailed step-by-step solution. Break the problem into small, atomic logical steps. Ensure high quality and clarity."
    },
    hint: { type: Type.STRING, description: "A helpful nudge without giving away the answer." },
    calculatorAllowed: { type: Type.BOOLEAN }
  },
  required: ["topic", "difficultyLevel", "questionText", "shortAnswer", "steps", "hint", "calculatorAllowed"]
};


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        // Robust retry for various network/server issues including the specific XHR error code 6
        const isNetworkError = 
            error.message?.includes('xhr error') || 
            error.message?.includes('fetch failed') ||
            error.message?.includes('network') ||
            error.code === 6; // Specific gRPC/XHR error code
            
        const isServerOrQuota = 
            error.status === 429 || 
            error.status >= 500 || 
            error.message?.includes('429') || 
            error.message?.includes('quota');

        if (retries > 0 && (isNetworkError || isServerOrQuota)) {
            console.warn(`Operation failed (Status: ${error.status}, Msg: ${error.message}). Retrying in ${delayMs}ms... (${retries} retries left)`);
            await delay(delayMs);
            return retryOperation(operation, retries - 1, delayMs * 2); // Exponential backoff
        }
        throw error;
    }
};

export const analyzeMathInput = async (input: UserInput): Promise<MathSolution> => {
  return retryOperation(async () => {
    try {
        const client = ensureClientReady();
        const isImage = input.type === 'image';
        
        const parts = isImage 
          ? [
              {
                inlineData: {
                  data: input.content,
                  mimeType: input.mimeType,
                },
              },
              {
                text: "You are an expert IB Math AA HL tutor. Analyze this image. \n\n1. **Transcription**: Transcribe the exercise statement exactly. If the text is blurry or cut off, RECONSTRUCT the logical mathematical problem statement into clear, coherent English. Use standard LaTeX delimiters ($...$) for all math expressions.\n\n2. **Solution**: Solve it step-by-step. Break down the solution into clear, logical steps.\n\n3. **Formatting**: BE EXTREMELY CONCISE. Short, punchy sentences. Highlight ONLY the most critical 1-2 keywords per step using **bold**. Use LaTeX for math. Provide the output strictly as JSON.",
              },
            ]
          : [
              {
                text: `You are an expert IB Math AA HL tutor. Solve the following math problem:\n\n"${input.content}"\n\n1. **Restatement**: Restate the problem clearly in the exerciseStatement field, using LaTeX ($...$).\n\n2. **Solution**: Solve it step-by-step. Break down the solution into clear, logical steps.\n\n3. **Formatting**: BE EXTREMELY CONCISE. Short, punchy sentences. Highlight ONLY the most critical 1-2 keywords per step using **bold**. Use LaTeX for math. Provide the output strictly as JSON.`,
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
    
    // Add all uploaded content to context
    inputs.forEach(input => {
        if (input.type === 'image' || input.type === 'pdf') {
            parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
        } else {
            parts.push({ text: `Source Material: ${input.content}` });
        }
    });

    let calcInstruction = "";
    if (settings.calculator === 'YES') {
        calcInstruction = "Questions MUST be Calculator Allowed. Adjust numbers if needed.";
    } else if (settings.calculator === 'NO') {
        calcInstruction = "Questions MUST be No Calculator. Adjust numbers if needed.";
    } else {
        calcInstruction = "Mix of Calc and No Calc.";
    }

    const prompt = `
      Create an IB Math AA HL Exam.
      
      SETTINGS:
      - Difficulty: ${settings.difficulty}
      - Duration: ${settings.durationMinutes} min
      - Topics: ${settings.topics.join(', ') || "General"}
      - Mode: ${calcInstruction}

      OUTPUT RULES:
      1. Output STRICT JSON.
      2. Markscheme must be a Markdown Table.
         - Columns: | Step | Working | Explanation | Marks |
         - CRITICAL: Marks (e.g. M1, A1) must be in the 'Marks' column ONLY.
         - Keep each row on a SINGLE line.
      3. Use LaTeX ($...$) for ALL math and numbers.
      4. QUESTION FORMATTING:
         - Preamble first.
         - Double Newline (\\n\\n).
         - Parts (a), (b)... separate by Double Newline (\\n\\n).
         - Marks at the VERY END of parts: **[4]**.
      5. CONSTRAINT: NO GRAPHING QUESTIONS. Do not ask students to draw graphs or analyze visual plots, as the exam is text/LaTeX based. Focus on Algebra, Calculus, and Logic.
      6. STRUCTURAL INTEGRITY:
         - Keep all parts of a question (a, b, c) inside a SINGLE 'questionText' field. Do not split them into separate question objects.
         - 'shortAnswer': Use DOUBLE NEWLINES (\\n\\n) to separate parts. Example: "(a) $x=2$ \\n\\n (b) $y=5$". 
           IMPORTANT: Do NOT include the plain text version of the math. Only output the LaTeX.
           WRONG: "x > 0 (x is greater than 0)"
           CORRECT: "$x > 0$"
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
            targetDifficulty = Math.min(10, targetDifficulty + 0.5); // Slight ramp up
        }

        // Christos Nikolaidis Style Injection
        const styleGuide = `
        STYLE GUIDE (Christos Nikolaidis / IB High Level):
        - Questions should be RIGOROUS and conceptually deep.
        - Avoid standard boilerplate questions.
        - Combine multiple topics (e.g. Complex Numbers + Polynomials, or Calculus + Trig).
        - Use precise IB terminology ("Hence or otherwise", "Show that").
        - Questions should feel like "Hard Exam Questions" not just textbook drills.
        `;

        const prompt = `
        Generate Drill Question #${questionNumber}.
        
        SETTINGS:
        - Target Difficulty: ${targetDifficulty}/10
        - Base Topics: ${settings.topics.join(', ') || "Mixed IB AA HL Topics"}
        - Calculator: ${settings.calculator}
        
        ${styleGuide}

        INSTRUCTIONS:
        1. Create a SINGLE, unique, high-quality IB Math AA HL question.
        2. Ensure it is distinct from previous generic questions. 
        3. Break it down into parts (a), (b) if necessary for structure.
        4. "steps" field MUST be a detailed "Smart Solver" style walkthrough, NOT a markscheme.
           - Break the solution into logical teaching steps.
           - Explain the 'Why', not just the 'How'.
        5. Output strictly JSON.
        `;

        parts.push({ text: prompt });

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: drillQuestionSchema,
                temperature: 0.8 // Higher temperature for variety
            },
        });

        const text = response.text;
        if (!text) throw new Error("No response");
        const q = JSON.parse(text) as DrillQuestion;
        
        // Ensure metadata is set correctly
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

                    Task: Provide a helpful, Socratic hint for a student stuck on this step. 
                    Do NOT give the answer. Point them to the relevant formula or concept.
                    Max 1-2 sentences.
                `}]
            }
        });
        return response.text || "Review the formula booklet for this topic.";
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
                    Current Step: ${step.title}
                    Equation: ${step.keyEquation}

                    Task: Break this single step down into 3-4 smaller, atomic sub-steps.
                    Explain exactly how we get from the previous state to this result.
                    Output as a JSON array of strings.
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
        return ["Analyze the equation terms.", "Apply standard algebraic rules."];
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
                    1. Use M1, A1, R1, AG codes in the Marks column.
                    2. Keep descriptions concise.
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