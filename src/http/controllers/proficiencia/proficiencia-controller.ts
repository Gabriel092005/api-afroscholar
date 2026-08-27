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

const idiomasInfo: Record<string, { nome: string; nomeEn: string; exame: string; niveis: string }> = {
  ingles:    { nome: "English",    nomeEn: "English",      exame: "TOEFL/IELTS/Cambridge", niveis: "Variable by test type" },
  frances:   { nome: "Français",  nomeEn: "French",       exame: "CEFR/DELF",             niveis: "A1, A2, B1, B2, C1, C2" },
  espanhol:  { nome: "Español",   nomeEn: "Spanish",      exame: "CEFR/DELE",             niveis: "A1, A2, B1, B2, C1, C2" },
  mandarim:  { nome: "中文",      nomeEn: "Chinese",      exame: "HSK",                   niveis: "HSK 1, HSK 2, HSK 3, HSK 4, HSK 5, HSK 6" },
  japones:   { nome: "日本語",    nomeEn: "Japanese",     exame: "JLPT",                  niveis: "N5, N4, N3, N2, N1" },
  alemao:    { nome: "Deutsch",   nomeEn: "German",       exame: "CEFR/Goethe",           niveis: "A1, A2, B1, B2, C1, C2" },
  italiano:  { nome: "Italiano",  nomeEn: "Italian",      exame: "CEFR/CELI",             niveis: "A1, A2, B1, B2, C1, C2" },
  coreano:   { nome: "한국어",    nomeEn: "Korean",       exame: "TOPIK",                 niveis: "TOPIK 1, TOPIK 2, TOPIK 3, TOPIK 4, TOPIK 5, TOPIK 6" },
  arabe:     { nome: "العربية",   nomeEn: "Arabic",       exame: "CEFR/ALPT",             niveis: "A1, A2, B1, B2, C1, C2" },
  russo:     { nome: "Русский",   nomeEn: "Russian",      exame: "CEFR/ТРКИ",             niveis: "A1, A2, B1, B2, C1, C2" },
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

const quizGenerateSchema = z.object({
  idioma: z.enum([
    "ingles", "frances", "espanhol", "mandarim", "japones",
    "alemao", "italiano", "coreano", "arabe", "russo",
  ]),
  tipo: tipoInglesSchema,
});

const quizSubmitSchema = z.object({
  idioma: z.enum([
    "ingles", "frances", "espanhol", "mandarim", "japones",
    "alemao", "italiano", "coreano", "arabe", "russo",
  ]),
  tipo: tipoInglesSchema,
  perguntas: z.array(z.object({
    pergunta: z.string(),
    opcoes: z.array(z.string()).length(4),
    correta: z.enum(["A", "B", "C", "D"]),
    categoria: z.string(),
    explicacao: z.string(),
  })),
  respostas: z.array(z.object({
    perguntaIndex: z.number(),
    resposta: z.enum(["A", "B", "C", "D"]),
  })),
});

const QUIZ_SYSTEM_PROMPT = `You are a language proficiency test generator. You generate high-quality multiple-choice quizzes for language learners.

CRITICAL RULES:
1. Generate EXACTLY 10 questions.
2. Each question MUST have exactly 4 options labeled as an array of 4 strings.
3. Exactly ONE option must be correct.
4. The "correta" field must be one of: "A", "B", "C", or "D" (corresponding to the 1st, 2nd, 3rd, or 4th option).
5. Questions must test DIFFERENT skills spread across categories: "vocabulario", "gramatica", "compreensao", "conjugacao", "expressoes".
6. Difficulty must be varied: 3 easy (A1-A2), 4 intermediate (B1-B2), 3 advanced (C1-C2).
7. ALL questions and ALL answer options MUST be written entirely in the TARGET LANGUAGE being tested. Do NOT write questions in Portuguese or English — write them in the language being tested.
8. The "explicacao" field must be written in Portuguese (for Brazilian students).
9. Questions should be relevant to academic and real-world contexts suitable for scholarship candidates.
10. Respond ONLY with valid JSON. No markdown, no code fences, no text outside the JSON.

EXACT JSON FORMAT (follow this structure precisely):
{
  "perguntas": [
    {
      "pergunta": "Full question text written in the target language",
      "opcoes": ["First option in target language", "Second option in target language", "Third option in target language", "Fourth option in target language"],
      "correta": "A",
      "categoria": "vocabulario",
      "explicacao": "Explicação em português do por que esta é a resposta correta"
    }
  ]
}

Valid category values: "vocabulario", "gramatica", "compreensao", "conjugacao", "expressoes"
Valid "correta" values: "A", "B", "C", "D" (index of correct option in the opcoes array, 0-based converted to letter)`;

const EVALUATION_PROMPT = `You are a certified language proficiency examiner. Based on the quiz results, provide a comprehensive evaluation.

RULES:
- Calculate the final score as a percentage (0-100).
- Determine the CEFR level based on the score: 0-20%: A1, 21-40%: A2, 41-60%: B1, 61-80%: B2, 81-95%: C1, 96-100%: C2.
- Provide scores for each category (0-10 scale).
- Write a detailed evaluation in Portuguese.
- Be encouraging but honest about areas for improvement.
- Include specific study recommendations.
- Respond ONLY with valid JSON.

JSON FORMAT:
{
  "pontuacao": 70,
  "corretas": 7,
  "nivel": "B2",
  "porCategoria": {
    "vocabulario": { "corretas": 2, "total": 2 },
    "gramatica": { "corretas": 2, "total": 3 },
    "compreensao": { "corretas": 1, "total": 2 },
    "conjugacao": { "corretas": 1, "total": 2 },
    "expressoes": { "corretas": 1, "total": 1 }
  },
  "avaliacao": "Sua avaliação detalhada aqui..."
}`;

export const gerarQuiz = async (
  req: FastifyRequest,
  res: FastifyReply,
) => {
  try {
    const { idioma, tipo } = quizGenerateSchema.parse(req.body);
    const openai = getOpenAI();

    const info = idiomasInfo[idioma] || idiomasInfo.ingles;
    const langName = info.nome;
    const langNameEn = info.nomeEn;

    let examContext = "";
    if (idioma === "ingles" && tipo && tipo !== "geral") {
      const t = tiposIngles[tipo];
      if (t) {
        examContext = ` for ${t.nome} format`;
      }
    }

    const userPrompt = `Generate a 10-question proficiency quiz for: ${langName} (${langNameEn})${examContext}

CRITICAL INSTRUCTIONS:
- ALL questions and ALL answer options MUST be written ENTIRELY in ${langName} (${langNameEn}).
- Do NOT write questions in Portuguese. Do NOT write questions in English (unless the target language IS English).
- The questions must test the ${langName} (${langNameEn}) language itself.
- The "explicacao" (explanation) field should be in Portuguese.
- Test a mix of skills: vocabulary, grammar, comprehension, conjugation, expressions.
- Vary difficulty: easy, intermediate, and advanced questions.`;

    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: QUIZ_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 6000,
      response_format: { type: "json_object" },
    } as any);

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    if (!parsed.perguntas || !Array.isArray(parsed.perguntas)) {
      return res.status(500).send({
        error: "Quiz Generation Error",
        message: "Failed to generate quiz questions. Please try again.",
      });
    }

    const perguntas = parsed.perguntas.slice(0, 10);

    if (perguntas.length < 5) {
      return res.status(500).send({
        error: "Quiz Generation Error",
        message: "Not enough questions were generated. Please try again.",
      });
    }

    const normalized = perguntas.map((p: any, idx: number) => ({
      pergunta: String(p.pergunta || ""),
      opcoes: Array.isArray(p.opcoes) ? p.opcoes.slice(0, 4).map(String) : ["", "", "", ""],
      correta: ["A", "B", "C", "D"].includes(p.correta) ? p.correta : "A",
      categoria: ["vocabulario", "gramatica", "compreensao", "conjugacao", "expressoes"].includes(p.categoria) ? p.categoria : "vocabulario",
      explicacao: String(p.explicacao || ""),
    }));

    return res.send({ perguntas: normalized });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        message: error.errors.map((e) => e.message).join(", "),
      });
    }

    if (error instanceof SyntaxError) {
      req.log.error(error);
      return res.status(500).send({
        error: "AI Response Error",
        message: "Failed to parse AI response. Please try again.",
      });
    }

    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Error generating quiz.",
    });
  }
};

export const submeterQuiz = async (
  req: FastifyRequest,
  res: FastifyReply,
) => {
  try {
    const { idioma, tipo, perguntas, respostas } = quizSubmitSchema.parse(req.body);
    const openai = getOpenAI();

    let corretas = 0;
    const porCategoria: Record<string, { corretas: number; total: number }> = {};

    for (const resposta of respostas) {
      const pergunta = perguntas[resposta.perguntaIndex];
      if (!pergunta) continue;

      if (!porCategoria[pergunta.categoria]) {
        porCategoria[pergunta.categoria] = { corretas: 0, total: 0 };
      }
      porCategoria[pergunta.categoria].total++;

      if (resposta.resposta === pergunta.correta) {
        corretas++;
        porCategoria[pergunta.categoria].corretas++;
      }
    }

    const total = perguntas.length;
    const pontuacao = Math.round((corretas / total) * 100);

    let nivel = "A1";
    if (pontuacao >= 96) nivel = "C2";
    else if (pontuacao >= 81) nivel = "C1";
    else if (pontuacao >= 61) nivel = "B2";
    else if (pontuacao >= 41) nivel = "B1";
    else if (pontuacao >= 21) nivel = "A2";

    const info = idiomasInfo[idioma] || idiomasInfo.ingles;
    const langName = info.nome;

    const resultados = respostas.map((r) => ({
      perguntaIndex: r.perguntaIndex,
      pergunta: perguntas[r.perguntaIndex].pergunta,
      respostaUsuario: r.resposta,
      respostaCorreta: perguntas[r.perguntaIndex].correta,
      correto: r.resposta === perguntas[r.perguntaIndex].correta,
      explicacao: perguntas[r.perguntaIndex].explicacao,
      categoria: perguntas[r.perguntaIndex].categoria,
    }));

    try {
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: "system", content: EVALUATION_PROMPT },
          { role: "user", content: `Quiz results for ${langName}${tipo && tipo !== "geral" ? ` (${tiposIngles[tipo]?.nome || tipo})` : ""}:\n\nScore: ${corretas}/${total} (${pontuacao}%)\nLevel: ${nivel}\n\nResults:\n${resultados.map((r) => `- Q${r.perguntaIndex + 1}: ${r.correto ? "Correct" : "Wrong"} (${r.respostaUsuario}/${r.respostaCorreta})`).join("\n")}` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content || "{}";
      const avaliacao = JSON.parse(content);

      return res.send({
        pontuacao,
        corretas,
        total,
        nivel: avaliacao.nivel || nivel,
        porCategoria: avaliacao.porCategoria || porCategoria,
        avaliacao: avaliacao.avaliacao || `Você acertou ${corretas} de ${total} perguntas.`,
        resultados,
      });
    } catch {
      return res.send({
        pontuacao,
        corretas,
        total,
        nivel,
        porCategoria,
        avaliacao: `Você acertou ${corretas} de ${total} perguntas (${pontuacao}%). Nível estimado: ${nivel}.`,
        resultados,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        message: error.errors.map((e) => e.message).join(", "),
      });
    }

    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Error submitting quiz.",
    });
  }
};
