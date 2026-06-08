import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import OpenAI from "openai";
import { env } from "@/Env";

const tipoInglesSchema = z.enum(["toefl", "ielts", "cambridge", "geral"]).optional();

const proficienciaSchema = z.object({
  idioma: z.enum([
    "ingles", "frances", "espanhol", "mandarim", "japones",
    "alemao", "italiano", "coreano", "arabe", "russo",
  ]).default("ingles"),
  tipo: tipoInglesSchema.default("geral"),
  mensagem: z.string().min(1, "Message is required"),
  historico: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
  finalizar: z.boolean().optional().default(false),
});

const tiposIngles: Record<string, { nome: string; desc: string; scoring: string; bandas: string }> = {
  toefl:     { nome: "TOEFL iBT",     desc: "Test of English as a Foreign Language",              scoring: "0-120 points",    bandas: "0-120 (Reading 0-30, Listening 0-30, Speaking 0-30, Writing 0-30)" },
  ielts:     { nome: "IELTS",         desc: "International English Language Testing System",      scoring: "1.0-9.0 Band",   bandas: "1.0 to 9.0 (Overall Band Score)" },
  cambridge: { nome: "Cambridge",     desc: "Cambridge English (FCE/CAE/CPE)",                    scoring: "Grade A/B/C",    bandas: "FCE (B2), CAE (C1), CPE (C2)" },
  geral:     { nome: "General English", desc: "General English Proficiency Assessment",           scoring: "CEFR",           bandas: "A1, A2, B1, B2, C1, C2" },
};

const idiomasInfo: Record<string, { nome: string; exame: string; niveis: string }> = {
  ingles:    { nome: "English",    exame: "TOEFL/IELTS/Cambridge", niveis: "Variable by test type" },
  frances:   { nome: "Français",  exame: "CEFR/DELF",             niveis: "A1, A2, B1, B2, C1, C2" },
  espanhol:  { nome: "Español",   exame: "CEFR/DELE",             niveis: "A1, A2, B1, B2, C1, C2" },
  mandarim:  { nome: "中文",      exame: "HSK",                   niveis: "HSK 1, HSK 2, HSK 3, HSK 4, HSK 5, HSK 6" },
  japones:   { nome: "日本語",    exame: "JLPT",                  niveis: "N5, N4, N3, N2, N1" },
  alemao:    { nome: "Deutsch",   exame: "CEFR/Goethe",           niveis: "A1, A2, B1, B2, C1, C2" },
  italiano:  { nome: "Italiano",  exame: "CEFR/CELI",             niveis: "A1, A2, B1, B2, C1, C2" },
  coreano:   { nome: "한국어",    exame: "TOPIK",                 niveis: "TOPIK 1, TOPIK 2, TOPIK 3, TOPIK 4, TOPIK 5, TOPIK 6" },
  arabe:     { nome: "العربية",   exame: "CEFR/ALPT",             niveis: "A1, A2, B1, B2, C1, C2" },
  russo:     { nome: "Русский",   exame: "CEFR/ТРКИ",             niveis: "A1, A2, B1, B2, C1, C2" },
};

function construirSystemPrompt(idioma: string, tipo?: string, finalizar?: boolean): string {
  const info = idiomasInfo[idioma] || idiomasInfo.ingles;
  const langName = info.nome;
  let exame = info.exame;
  let niveis = info.niveis;
  let testSpecific = "";

  if (idioma === "ingles" && tipo && tipo !== "geral") {
    const t = tiposIngles[tipo];
    if (t) {
      exame = t.nome;
      niveis = t.bandas;
      testSpecific = `\n## Test-specific instructions:
You are simulating a **${t.nome}** (${t.desc}) test.
- Scoring system: ${t.scoring}
- Band/skill breakdown: ${t.bandas}
- Follow the format and question styles typical of the ${t.nome} exam
- Evaluate the student's performance as if this were a real ${t.nome} test
- Provide an estimated ${t.nome} score/band in the final evaluation`;
    }
  }

  let prompt = `You are Teacher ERick, an official language proficiency examiner from Afroscholars.

## Your personality:
- You are professional, encouraging, and patient
- You speak the target language clearly and naturally
- You are friendly but maintain a professional examiner role
- You correct mistakes gently and encourage improvement
- You adapt your language complexity based on the student's level

## Your role:
You conduct language proficiency assessments for scholarship candidates.
The language being tested is: **${langName}**
The evaluation framework is: **${exame}** (${niveis})

Your mission is to evaluate the student's level across these areas:
- Speaking (fluency and coherence)
- Vocabulary (range and precision)
- Grammar (accuracy and complexity)
- Pronunciation (clarity and intelligibility)
- Comprehension (understanding and responding appropriately)${testSpecific}

## Important rules:
1. You ALWAYS conduct the ENTIRE test in **${langName}** — all questions, responses, and feedback must be in the target language
2. Do NOT use emojis — maintain a professional tone
3. You ask ONE question at a time and wait for the student's response
4. You evaluate each answer and adapt subsequent questions to the student's level
5. At the end, you provide a complete evaluation with the appropriate level (${niveis})
6. Be encouraging — make the student feel comfortable using ${langName}
7. If the student struggles, simplify your language; if they excel, increase complexity
8. Do NOT invent information not provided by the student
9. Correct mistakes gently when they occur`;

  if (finalizar) {
    prompt += `\n\n## FINAL INSTRUCTION:
The student has requested to end the test. Do NOT ask any more questions.
Immediately generate a complete **${langName} Proficiency Evaluation** (in the target language) including:
1. **Level** (${niveis})
2. **Scores by Area:**
   - Speaking (0-100%)
   - Vocabulary (0-100%)
   - Grammar (0-100%)
   - Pronunciation (0-100%)
   - Comprehension (0-100%)
3. **Overall Score** (0-100%)
4. **Strengths** — what the student does well
5. **Areas for Improvement** — what needs work
6. **Tips** — specific recommendations to improve ${langName}
7. **Scholarship Readiness** — is the level sufficient for international scholarships?

Format the evaluation clearly and professionally. Write the evaluation in ${langName}.`;
  } else {
    prompt += `\n\n## Test Structure:
1. **Introduction** — Greet the student, introduce yourself in ${langName}, explain the test, and ask them to introduce themselves
2. **Question 1** — Ask about their studies/work and why they want a scholarship
3. **Question 2** — Ask about their future plans and goals
4. **Question 3** — Ask them to describe a personal experience or challenge
5. **Question 4** — Ask for their opinion on an education-related topic
6. **Question 5** — Ask them to describe a place they would like to visit and why
7. **Question 6** — Ask a hypothetical question about cultural adaptation
8. **Closing** — Thank them and ask if they have questions or want to end the test

Ask ONE question at a time in ${langName}. Wait for the student to answer before proceeding.`;
  }

  return prompt;
}

function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured in .env");
  }
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    timeout: env.OPENAI_TIMEOUT,
    maxRetries: 2,
  });
}

export const proficienciaConversa = async (
  req: FastifyRequest,
  res: FastifyReply,
) => {
  try {
    const { idioma, tipo, mensagem, historico, finalizar } = proficienciaSchema.parse(req.body);
    const openai = getOpenAI();

    const systemPrompt = construirSystemPrompt(idioma, tipo, finalizar);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...historico.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: mensagem },
    ];

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: env.OPENAI_MAX_TOKENS,
    });

    const resposta = completion.choices[0]?.message?.content
      || "Sorry, I could not process your response. Could you please repeat?";

    return res.send({
      resposta,
      historico: [
        ...historico,
        { role: "user", content: mensagem },
        { role: "assistant", content: resposta },
      ],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        message: error.errors.map((e) => e.message).join(", "),
      });
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return res.status(503).send({
        error: "AI Connection Error",
        message: "Could not connect to the AI server. Check your internet connection.",
      });
    }

    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return res.status(504).send({
        error: "AI Timeout",
        message: "The AI server took too long to respond. Please try again.",
      });
    }

    if (error instanceof OpenAI.AuthenticationError) {
      return res.status(500).send({
        error: "AI Auth Error",
        message: "Invalid or expired API key. Contact the administrator.",
      });
    }

    if (error instanceof OpenAI.RateLimitError) {
      return res.status(429).send({
        error: "AI Rate Limit",
        message: "Rate limit exceeded. Please wait and try again.",
      });
    }

    if (error instanceof OpenAI.BadRequestError) {
      return res.status(400).send({
        error: "AI Bad Request",
        message: `AI request error: ${error.message}`,
      });
    }

    if (error instanceof OpenAI.NotFoundError) {
      return res.status(500).send({
        error: "AI Model Not Found",
        message: `The AI model "${env.OPENAI_MODEL}" is not available. Contact the administrator.`,
      });
    }

    if (error instanceof OpenAI.InternalServerError) {
      return res.status(502).send({
        error: "AI Server Error",
        message: "The AI server encountered an internal error. Try again later.",
      });
    }

    if (error instanceof Error && error.message === "OPENAI_API_KEY not configured in .env") {
      return res.status(500).send({
        error: "AI Not Configured",
        message: "The AI examiner has not been configured yet. Contact the administrator.",
      });
    }

    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Error processing proficiency test.",
    });
  }
};
