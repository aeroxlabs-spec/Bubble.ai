
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MathSolution, MathStep, UserInput, ExamSettings, ExamPaper } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      description: "The final result. Format as a strict Markdown bulleted list if there are multiple parts. YOU MUST enclose the definitive numerical answer or final expression in LaTeX format (e.g. $x=5$) or **bold** to ensuring it is displayed as a distinct value. Do not show numbers as plain text.",
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota'))) {
            console.warn(`Quota exceeded. Retrying in ${delayMs}ms... (${retries} retries left)`);
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
    
        const response = await ai.models.generateContent({
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
         - CRITICAL: Marks (e.g. M1, A1) must be in the 'Marks' column ONLY. Do NOT put them in Explanation.
         - Do not use newlines inside a table cell. Use spaces for separation.
         - Do NOT use HTML tags like <br>. Use spaces to separate multiple marks (e.g. "M1 A1").
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

    const response = await ai.models.generateContent({
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

export const createChatSession = (
  initialContext: string,
  history: { role: string; parts: { text: string }[] }[] = []
) => {
  const chat = ai.chats.create({
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
        const response = await ai.models.generateContent({
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
          const response = await ai.models.generateContent({
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
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `
                    You are an official IB Math AA HL Examiner. 
                    Create a formal MARKSCHEME for the following problem:
                    
                    Problem: "${exerciseStatement}"
                    Solution Context: ${stepsJson}

                    Formatting Rules:
                    1. Use a standard Markscheme layout.
                    2. Use official IB Marking codes in the "Marks" column:
                       - **M1**: Method mark (for attempting a valid method)
                       - **A1**: Accuracy mark (for correct values)
                       - **R1**: Reasoning mark (for correct explanations)
                       - **(A1)**: Implied Accuracy
                       - **AG**: Answer Given
                    3. Output a SINGLE Markdown table with these exact columns:
                       | Step | Working | Explanation | Marks |
                    4. Ensure the table has a header row and a delimiter row (e.g. |---|---|).
                    5. Ensure all math is valid LaTeX wrapped in $ (inline math). DO NOT use block math ($$...$$) as it causes table formatting errors.
                    6. Be strictly professional and precise.
                    7. Do NOT use newlines in cells. Use spaces.
                    8. MARK COLUMN MUST BE LAST. Do not put M1 in Explanation column.
                    9. SEPARATION: Use SPACES to separate multiple marks (e.g. "M1 A1"). Do NOT use HTML tags like <br>.
                    10. Keep each row on a SINGLE line to avoid table breaking.
                    11. Ensure the table markdown is NOT wrapped in a code block. Return ONLY the markdown table.
                `
            });
            return response.text || "Markscheme generation failed.";
        } catch (error) {
            console.error("Error generating markscheme:", error);
            throw error;
        }
    });
}
