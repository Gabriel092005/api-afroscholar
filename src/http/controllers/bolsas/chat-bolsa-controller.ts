import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import OpenAI from "openai";
import { env } from "@/Env";

const chatSchema = z.object({
  bolsaId: z.string().uuid().optional(),
  mensagem: z.string().min(1, "Mensagem é obrigatória"),
  historico: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
  perfilAcademico: z.object({
    nivelEnsino: z.string().optional(),
    instituicao: z.string().optional(),
    curso: z.string().optional(),
    nivel: z.string().optional(),
    anoConclusao: z.string().optional(),
    media: z.string().optional(),
    pais: z.string().optional(),
    genero: z.string().optional(),
    nacionalidade: z.string().optional(),
    cidade: z.string().optional(),
    whatsapp: z.string().optional(),
    provincia: z.string().optional(),
    municipio: z.string().optional(),
    idiomas: z.string().optional(),
    certificadosIdiomas: z.string().optional(),
    dataNascimento: z.string().optional(),
    motivacoes: z.string().optional(),
    experienciaProfissional: z.string().optional(),
    areaActuacao: z.string().optional(),
    cargoOcupado: z.string().optional(),
    historicoProfissional: z.string().optional(),
    areaInteresse: z.string().optional(),
    cursoDesejado: z.string().optional(),
    objetivosAcademicos: z.string().optional(),
    quandoPretendeIniciar: z.string().optional(),
    bolsaIntegral: z.string().optional(),
    bolsaParcial: z.string().optional(),
    custeiaPassagem: z.string().optional(),
    preferenciaDestino: z.string().optional(),
    mudarPais: z.string().optional(),
    qualquerContinente: z.string().optional(),
    documentos: z.string().optional(),
    atividadesExtracurriculares: z.string().optional(),
    producaoCientifica: z.string().optional(),
    fotoUrl: z.string().optional(),
  }).optional(),
});

function formatarData(data?: Date | string | null): string {
  if (!data) return "Não especificada";
  try {
    const d = new Date(data);
    return d.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  } catch { return String(data); }
}

function construirContextoBolsa(bolsa: any): string {
  const prazo = formatarData(bolsa.prazo);
  const valor = bolsa.valor > 0 ? `${bolsa.moeda} ${Number(bolsa.valor).toLocaleString()}` : "Gratuita";
  const original = bolsa.precoOriginal && bolsa.precoOriginal > 0 && bolsa.precoOriginal !== bolsa.valor
    ? ` (original: ${bolsa.moeda} ${Number(bolsa.precoOriginal).toLocaleString()})` : "";
  const vagas = bolsa.numeroVagas ? `${bolsa.numeroVagas} vagas` : "Não especificado";

  return `
### ${bolsa.titulo}
- **Subtítulo:** ${bolsa.subtitulo || "N/A"}
- **Categoria:** ${bolsa.categoria}
- **Instituição:** ${bolsa.instituicao || "N/A"}
- **País:** ${bolsa.pais || "N/A"}
- **Nível:** ${bolsa.nivel || "N/A"}
- **Modalidade:** ${bolsa.modalidade || "N/A"}
- **Idioma:** ${bolsa.idioma || "N/A"}
- **Valor:** ${valor}${original}
- **Prazo:** ${prazo}
- **Vagas:** ${vagas}
- **Requisitos:** ${bolsa.requisitos || "Não especificados"}
- **Descrição:** ${(bolsa.descricao || "Sem descrição").substring(0, 500)}
- **Link para candidatura:** ${bolsa.linkAplicar || "N/A"}
`;
}

function construirContextoPerfil(perfil: any): string {
  if (!perfil) return "";
  const certs = perfil.certificadosIdiomas ? perfil.certificadosIdiomas.split(",").filter(Boolean) : [];
  const areas = perfil.areaInteresse ? perfil.areaInteresse.split(",").filter(Boolean) : [];
  const docs = perfil.documentos ? perfil.documentos.split(",").filter(Boolean) : [];
  const ativs = perfil.atividadesExtracurriculares ? perfil.atividadesExtracurriculares.split(",").filter(Boolean) : [];
  const prods = perfil.producaoCientifica ? perfil.producaoCientifica.split(",").filter(Boolean) : [];
  return `
## Perfil do Estudante:
- **Nível de Ensino:** ${perfil.nivelEnsino || "Não informado"}
- **Instituição:** ${perfil.instituicao || "Não informada"}
- **Curso:** ${perfil.curso || "Não informado"}
- **Ano/Classe:** ${perfil.nivel || "Não informado"}
- **Ano de Conclusão:** ${perfil.anoConclusao || "Não informado"}
- **Média/Classificação:** ${perfil.media || "Não informada"}
- **Género:** ${perfil.genero || "Não informado"}
- **Nacionalidade:** ${perfil.nacionalidade || "Não informada"}
- **País de Origem:** ${perfil.pais || "Não informado"}
- **Província:** ${perfil.provincia || "Não informada"}
- **Cidade/Município:** ${perfil.municipio || "Não informado"}
- **Idiomas:** ${perfil.idiomas || "Não informados"}
- **Certificados de Idioma:** ${certs.length > 0 ? certs.join(", ") : "Nenhum"}
- **Áreas de Interesse:** ${areas.length > 0 ? areas.join(", ") : "Não informadas"}
- **Curso Desejado:** ${perfil.cursoDesejado || "Não informado"}
- **Quando Pretende Iniciar:** ${perfil.quandoPretendeIniciar || "Não informado"}
- **Preferência de Destino:** ${perfil.preferenciaDestino || "Não informada"}
- **Disposto a Mudar de País:** ${perfil.mudarPais === "SIM" ? "Sim" : perfil.mudarPais === "NAO" ? "Não" : "Não informado"}
- **Disponível para Qualquer Continente:** ${perfil.qualquerContinente === "SIM" ? "Sim" : perfil.qualquerContinente === "NAO" ? "Não" : "Não informado"}
- **Necessita Bolsa Integral:** ${perfil.bolsaIntegral === "SIM" ? "Sim" : perfil.bolsaIntegral === "NAO" ? "Não" : "Não informado"}
- **Aceita Bolsa Parcial:** ${perfil.bolsaParcial === "SIM" ? "Sim" : perfil.bolsaParcial === "NAO" ? "Não" : "Não informado"}
- **Pode Custear Passagem:** ${perfil.custeiaPassagem === "SIM" ? "Sim" : perfil.custeiaPassagem === "NAO" ? "Não" : "Não informado"}
- **Experiência Profissional:** ${perfil.experienciaProfissional || "Não informada"}
- **Área de Actuação:** ${perfil.areaActuacao || "Não informada"}
- **Cargo Ocupado:** ${perfil.cargoOcupado || "Não informado"}
- **Histórico Profissional:** ${perfil.historicoProfissional || "Não informado"}
- **Actividades Extra-Curriculares:** ${ativs.length > 0 ? ativs.join(", ") : "Nenhuma"}
- **Produção Científica:** ${prods.length > 0 ? prods.join(", ") : "Nenhuma"}
- **Documentos Disponíveis:** ${docs.length > 0 ? docs.join(", ") : "Nenhum"}
- **Objectivos Académicos:** ${perfil.objetivosAcademicos || "Não informados"}
- **Motivações:** ${perfil.motivacoes || "Não informadas"}`;
}

function construirSystemPrompt(
  bolsaEspecifica: any | null,
  todasBolsas: any[],
  perfilAcademico?: any,
): string {
  const total = todasBolsas.length;
  const abertas = todasBolsas.filter((b) => {
    if (!b.prazo) return true;
    try { return new Date(b.prazo).getTime() > Date.now(); } catch { return true; }
  }).length;

  let prompt = `Tu és a Helena mentora da Afroscholars, criada por Ageu Zenguela Mafumba.

Como você se chama? Informe o país ou a oportunidade no exterior que você deseja conquistar: universidade, bolsa de estudo, intercâmbio, estágio ou trabalho..

## A tua personalidade:
- És amigável, caloroso e entusiasta
- Quando inicias uma conversa ou saúdas, deves sempre mencionar que és a Helena, assistente da Afroscholars, empresa fundada por Ageu Zenguela
- Usas um tom conversacional e natural em português de Angola/Portugal
- MOSTRAS empatia e compreensão pelas preocupações dos estudantes
- És paciente e explicas conceitos complexos de forma simples
- Usas occasionalmente emojis para tornar a conversa mais humana 😊
- ADAPTAS o teu estilo conforme o contexto e emoção do utilizador

## A tua capacidade especial:
Tens acesso ao perfil académico completo do estudante. Podes e deves:
- Analisar o perfil académico (nível de ensino, curso, média, instituição, idiomas, motivações e experiência profissional)
- Recomendar bolsas específicas e personalizadas com base no perfil
- Sugerir quais bolsas têm mais chances de aprovação dadas as qualificações do estudante
- Ajudar a identificar lacunas no perfil e sugerir melhorias
- Quando o estudante pedir recomendações, USAS O PERFIL DELE para fazer uma análise personalizada

## Regras importantes:
1. Responde SEMPRE em português (pt-PT/pt-AO)
2. Sê específico e detalhista — usa dados reais das bolsas
3. Quando recomendar bolsas, explica PORQUE cada bolsa é adequada ao perfil do estudante
4. Se não souberes algo, admite naturalmente em vez de inventar
5. Quando apropriado, faz perguntas de seguimento para ajudar o utilizador
6. Recomenda bolsas com base no perfil do utilizador (área, nível, país, motivações)
7. Explica o processo de candidatura de forma clara
8. NÃO inventes informações que não estejam no contexto fornecido
9. Se perguntarem algo fora do teu âmbito, redireciona gentilmente para o tema das bolsas`;

  if (total > 0) {
    prompt += `\n\n## Contexto geral da plataforma:\nTemos **${total} bolsas** cadastradas no total, sendo **${abertas}** com prazo ainda aberto.`;

    prompt += `\n\n## Lista de todas as bolsas disponíveis:\n`;
    todasBolsas.slice(0, 20).forEach((b, i) => {
      const ativa = b.prazo ? (new Date(b.prazo).getTime() > Date.now() ? "✅" : "❌") : "✅";
      prompt += `\n${i + 1}. ${ativa} **${b.titulo}** — ${b.pais || "N/A"} — ${b.nivel || "N/A"} — ${b.categoria}`;
    });
    if (todasBolsas.length > 20) {
      prompt += `\n\n...e mais ${todasBolsas.length - 20} bolsas.`;
    }
  } else {
    prompt += `\n\n## Nota:\nAtualmente não há bolsas cadastradas na plataforma.`;
  }

  if (perfilAcademico) {
    prompt += `\n\n${construirContextoPerfil(perfilAcademico)}`;
  }

  if (bolsaEspecifica) {
    prompt += `\n\n## Contexto detalhado da bolsa que o utilizador está a ver:\n${construirContextoBolsa(bolsaEspecifica)}`;
  }

  return prompt;
}

function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada no .env");
  }
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    timeout: env.OPENAI_TIMEOUT,
    maxRetries: 2,
  });
}

export const chatBolsa = async (
  req: FastifyRequest,
  res: FastifyReply,
) => {
  try {
    const { bolsaId, mensagem, historico, perfilAcademico } = chatSchema.parse(req.body);
    const openai = getOpenAI();

    const todasBolsasRaw = await prisma.bolsa.findMany({
      where: { status: "PUBLICADA" },
      orderBy: { created_at: "desc" },
    });

    let bolsaEspecifica: any = null;
    if (bolsaId) {
      bolsaEspecifica = todasBolsasRaw.find((b) => b.id === bolsaId) || null;
    }

    const systemPrompt = construirSystemPrompt(bolsaEspecifica, todasBolsasRaw, perfilAcademico);

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
      temperature: 0.8,
      max_tokens: env.OPENAI_MAX_TOKENS,
    });

    const resposta = completion.choices[0]?.message?.content
      || "Desculpe, não consegui processar a sua pergunta. Pode tentar novamente?";

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
        message: "Não foi possível conectar ao servidor da IA. Verifique sua conexão com a internet.",
      });
    }

    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return res.status(504).send({
        error: "AI Timeout",
        message: "O servidor da IA demorou muito a responder. Tente novamente.",
      });
    }

    if (error instanceof OpenAI.AuthenticationError) {
      return res.status(500).send({
        error: "AI Auth Error",
        message: "Chave da API OpenAI inválida ou expirada. Contacte o administrador.",
      });
    }

    if (error instanceof OpenAI.RateLimitError) {
      return res.status(429).send({
        error: "AI Rate Limit",
        message: "Limite de requisições à IA excedido. Aguarde um momento e tente novamente.",
      });
    }

    if (error instanceof OpenAI.BadRequestError) {
      return res.status(400).send({
        error: "AI Bad Request",
        message: `Erro na requisição à IA: ${error.message}`,
      });
    }

    if (error instanceof OpenAI.NotFoundError) {
      return res.status(500).send({
        error: "AI Model Not Found",
        message: `O modelo de IA "${env.OPENAI_MODEL}" não está disponível. Contacte o administrador.`,
      });
    }

    if (error instanceof OpenAI.InternalServerError) {
      return res.status(502).send({
        error: "AI Server Error",
        message: "O servidor da IA encontrou um erro interno. Tente novamente mais tarde.",
      });
    }

    if (error instanceof Error && error.message === "OPENAI_API_KEY não configurada no .env") {
      return res.status(500).send({
        error: "AI Not Configured",
        message: "O assistente IA ainda não foi configurado. Contacte o administrador.",
      });
    }

    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao processar chat.",
    });
  }
};
