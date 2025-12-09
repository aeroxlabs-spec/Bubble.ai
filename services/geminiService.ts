import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper, DrillSettings, DrillQuestion, ExamDifficulty } from "../types";

// Helper to safely get API key without crashing if process is undefined
const getApiKey = () => {
    try {
        // Fallback to process.env (Node/Webpack/Standard)
        if (typeof process !== 'undefined' && process.env?.API_KEY) {
            return process.env.API_KEY;
        }
    } catch(e) {}
    
    try {
        // Check import.meta.env without VITE_ prefix if configured via custom build
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.API_KEY) {
            // @ts-ignore
            return import.meta.env.API_KEY;
        }
    } catch(e) {}

    return "";
};

// Lazy initialization of the AI client
let aiInstance: GoogleGenAI | null = null;

const getAiClient = () => {
    if (!aiInstance) {
        const apiKey = getApiKey();
        // We allow initialization with empty key to prevent crash on load, 
        // but actual calls will fail if key is missing.
        aiInstance = new GoogleGenAI({ apiKey: apiKey || "MISSING_KEY" });
    }
    return aiInstance;
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
            description: "A VERY CONCISE explanation. Short sentences. Highlight ONLY 1-2 keywords per sentence using **bold**. DO NOT highlight entire phrases.",
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
        description: "The full question. STRICT FORMATTING: 1. Start with the preamble/setup text. 2. Use DOUBLE NEWLINES (\\n\\n) to separate the preamble from Part (a). 3. Use DOUBLE NEWLINES between all parts. 4. CRITICAL: Do NOT include marks (e.g. [4]) in the text. 5. CRITICAL: Use LaTeX ($...$) for ALL math expressions and numbers." 
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
    
        const response = await getAiClient().models.generateContent({
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
           NEVER output "null" string.
         - 'markscheme': Start the string with | Step | ... Ensure it is a valid markdown table. NEVER output "null" string. Do NOT use newlines inside cells.
         - 'steps': Provide generalized steps that cover all parts of the question. USE LATEX for numbers (e.g. $1$, $5$, $\\pi$).
    `;

    parts.push({ text: prompt });

    const response = await getAiClient().models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: examPaperSchema,
            temperature: 0.7 
        }
    });

    const text = response.text;
    if (!text) throw new Error("Failed to generate exam");
    return JSON.parse(text) as ExamPaper;
  });
};

export const generateDrillQuestion = async (
    settings: DrillSettings, 
    inputs: UserInput[], 
    questionNumber: number,
    previousDifficulty: number
): Promise<DrillQuestion> => {
    return retryOperation(async () => {
        const parts: any[] = [];
        
        inputs.forEach(input => {
            if (input.type === 'image' || input.type === 'pdf') {
                parts.push({ inlineData: { data: input.content, mimeType: input.mimeType } });
            } else {
                parts.push({ text: `Drill Material: ${input.content}` });
            }
        });

        // Adapt difficulty: Start based on setting, then increment
        let targetDifficulty = previousDifficulty;
        if (questionNumber === 1) {
            // Initial setting mapping
            if (settings.difficulty === 'STANDARD') targetDifficulty = 3;
            if (settings.difficulty === 'HARD') targetDifficulty = 6;
            if (settings.difficulty === 'HELL') targetDifficulty = 8;
        } else {
            // Adaptive increment
            targetDifficulty = Math.min(10, previousDifficulty + 0.5);
        }

        const prompt = `
            Generate a SINGLE IB Math AA HL Practice Question for Drill Mode.
            
            CONTEXT & STYLE GUIDELINES:
            1. **Variety & Randomness**: The user requires HIGH variety. 
               - Mix VERY EASY concepts (definitions, basic computation) with VERY HARD multi-step problems. 
               - Do not just output standard "Solve for x" questions. 
               - Use diverse topics: Complex Numbers, Vectors, Calculus, Probability, Proofs.
               - Even if the target difficulty is high, occasionally throw in a conceptual "easy" question to test basics.
            2. **Style**: Emulate the rigor and style of high-quality resources like **Christos Nikolaidis (MAA Exercises)** or **IB HL Past Papers**.
            3. **Anti-Repetition**: Ensure this question is significantly different from a generic textbook example. Use unique parameters.
            
            Parameters:
            - Question Number: ${questionNumber}
            - Topic: ${settings.topics.length > 0 ? `Focus on: ${settings.topics.join(', ')}` : "Any Core Topic"}
            - Target Difficulty: ${targetDifficulty}/10. (But allow variance +/- 2).
            - Calculator: ${settings.calculator}
            
            FORMATTING RULES (CRITICAL):
            1. **Structured Text**: separate the setup (preamble) from the parts using DOUBLE NEWLINES (\\n\\n).
            2. **Separators**: Use DOUBLE NEWLINES (\\n\\n) between every part (a), (b), etc. Each part MUST start on a new line.
            3. **Part Labels**: Start parts with (a), (b), (c).
            4. **NO MARKS**: Do NOT include marks like [4] or [5] in the question text. This is purely for practice.
            5. **Math formatting**: Use strict LaTeX ($...$) for ALL math expressions and numbers.
            6. **Smart Solver Solution**: The 'steps' field must be a structured array of logical steps (title, explanation, keyEquation), mimicking the high-quality breakdown of a Smart Solver. Do NOT just dump text.
            7. **Short Answer**: Ensure ALL parts are separated by DOUBLE NEWLINES (\\n\\n) in the shortAnswer field so they render on separate lines.
            8. **JSON**: Output strict JSON.
        `;
        
        parts.push({ text: prompt });

        const response = await getAiClient().models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: drillQuestionSchema,
                temperature: 0.95 // High temperature for maximum variety
            }
        });

        const text = response.text;
        if (!text) throw new Error("Failed to generate drill");
        
        const q = JSON.parse(text) as DrillQuestion;
        q.id = crypto.randomUUID();
        q.number = questionNumber;
        return q;
    });
};

export const createChatSession = (
  initialContext: string,
  history: { role: string; parts: { text: string }[] }[] = []
) => {
  const chat = getAiClient().chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: `You are an expert IB Math AA HL Examiner and Tutor named Bubble. 
      You are helping a student understand a specific problem.
      
      Persona Guidelines:
      1. **Expertise**: You have deep knowledge of the IB Math Analysis & Approaches HL curriculum.
      2. **Tone**: Encouraging, precise, and professional.
      3. **Formatting**: 
         - Be EXTREMELY CONCISE. Do not be wordy. Short sentences.
         - Highlight ONLY 1-2 keywords per response using **bold**.
         - Use LaTeX for math ($...$).
      4. **Goal**: Guide the student to the answer rather than just giving it if they are stuck. If they ask for clarification, explain the "why" behind the "how".
      
      Current Problem Context:
      ${initialContext}`,
    },
    history: history,
  });

  return chat;
};

export const getStepHint = async (step: MathStep, problemContext: string): Promise<string> => {
  return retryOperation(async () => {
      try {
        const response = await getAiClient().models.generateContent({
          model: "gemini-2.5-flash",
          contents: `
            Context: "${problemContext}"
            Step: "${step.title}" - "${step.keyEquation}"
            
            Give a 1-sentence hint for this step. 
            CRITICAL: Use standard LaTeX with $ delimiters for math (e.g. $x^2$).
            Bold the main keyword.
          `,
        });
        return response.text || "Try reviewing the previous step and checking your algebra.";
      } catch (error) {
        console.error("Error generating hint:", error);
        return "Could not generate a hint at this time.";
      }
  });
};

export const getStepBreakdown = async (step: MathStep, problemContext: string): Promise<string[]> => {
    return retryOperation(async () => {
        try {
          const response = await getAiClient().models.generateContent({
            model: "gemini-2.5-flash",
            contents: `
              Context: "${problemContext}"
              Break down step "${step.title}" (${step.keyEquation}) into 3 atomic logical sub-steps.
              
              OUTPUT RULES:
              1. Return valid JSON array of strings.
              2. Use standard LaTeX ($x$) for math. Do NOT use \\( \\) or \\text{}.
              3. Keep sentences under 10 words.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
          });
          
          const text = response.text;
          if (!text) return ["Analyze the equation.", "Simplify terms.", "Calculate result."];
          
          const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
          
          return JSON.parse(cleanText) as string[];
        } catch (error) {
          console.error("Error generating breakdown:", error);
          return ["Could not break down this step further."];
        }
    });
};

export const getMarkscheme = async (exerciseStatement: string, stepsJson: string): Promise<string> => {
    return retryOperation(async () => {
        try {
            const response = await getAiClient().models.generateContent({
                model: "gemini-2.5-flash",
                contents: `
                    You are an official IB Math AA HL Examiner. 
                    Create a formal MARKSCHEME for the following problem.
                    
                    Problem: "${exerciseStatement}"
                    Solution Context: ${stepsJson}

                    Formatting Rules:
                    1. **Strict Markdown Table**:
                       - Columns: | Part | Working | Explanation | Marks |
                       - **Column 1 (Part)**: Keep minimal (e.g. (a)).
                       - **Column 2 (Working)**: The main math steps. LaTeX required ($...$).
                       - **Column 3 (Explanation)**: Very brief reasoning (e.g. "Chain rule").
                       - **Column 4 (Marks)**: Official codes ONLY (M1, A1, R1).
                    
                    2. **Content Density**:
                       - NO EMPTY ROWS.
                       - Combine related steps into one row to save space.
                       - Do NOT use <br> tags. 
                       - If a part has multiple marks, list them in the same cell separated by spaces (e.g. "M1 A1").
                       
                    3. **Cleanliness**:
                       - Remove all unnecessary whitespace.
                       - Do NOT bold math expressions.
                       - Do NOT use newlines characters (\n) inside table cells.
                       - Return ONLY the table.
                `
            });
            return response.text || "Markscheme generation failed.";
        } catch (error) {
            console.error("Error generating markscheme:", error);
            throw error;
        }
    });
}