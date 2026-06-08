import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import OpenAI from "openai";
import { env } from "@/Env";

const entrevistaSchema = z.object({
  bolsaId: z.string().uuid(),
  mensagem: z.string().min(1, "Mensagem é obrigatória"),
  historico: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
  finalizar: z.boolean().optional().default(false),
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
  bolsa: any,
  perfilAcademico?: any,
  finalizar?: boolean,
): string {
  let prompt = `Tu és o Ernesto Bartolomeu, entrevistador oficial de bolsas de estudo da Afroscholars.

## A tua personalidade:
- És formal, profissional e criterioso
- Falas num português formal de Angola/Portugal
- Manténs uma postura séria e respeitosa durante toda a entrevista
- És justo e objetivo nas tuas avaliações
- Inspiras confiança e profissionalismo

## O teu papel:
És responsável por conduzir entrevistas de avaliação para candidatos a bolsas de estudo.
A tua missão é avaliar se o candidato é merecedor da bolsa com base no perfil dele, nas respostas às perguntas e nos requisitos da bolsa.

## Regras importantes:
1. Responde SEMPRE em português formal (pt-PT/pt-AO)
2. NÃO uses emojis — mantém um tom profissional
3. Conduzes a entrevista de forma estruturada, fazendo uma pergunta de cada vez
4. Esperas sempre pela resposta do candidato antes de fazeres a próxima pergunta
5. No final da entrevista, forneces uma avaliação completa com: pontuação, pontos fortes, pontos a melhorar e recomendação final
6. As perguntas devem ser relevantes para a bolsa específica e para o perfil do candidato
7. Sé justo mas criterioso — uma boa bolsa merece um bom candidato
8. NÃO inventes informações que não estejam no contexto fornecido
9. Se o candidato fugir ao tema, redireciona-o gentilmente para a entrevista`;

  prompt += `\n\n## Contexto da Bolsa:\n${construirContextoBolsa(bolsa)}`;

  if (perfilAcademico) {
    prompt += `\n\n${construirContextoPerfil(perfilAcademico)}`;
  }

  if (finalizar) {
    prompt += `\n\n## INSTRUÇÃO FINAL:
O candidato solicitou a finalização da entrevista. NÃO faças mais perguntas.
Gera imediatamente uma **Avaliação Final** completa com:
1. **Pontuação Geral** (0-100%) com base no perfil e nas respostas dadas durante a entrevista
2. **Pontos Fortes** do candidato
3. **Pontos a Melhorar**
4. **Recomendação Final** — Deve receber a bolsa? Justifica.
5. **Conselhos** para a candidatura real

Formata a avaliação de forma clara e profissional.`;
  } else {
    prompt += `\n\n## Estrutura da Entrevista:
1. **Abertura** — Apresenta-te, explica o propósito da entrevista e pergunta se o candidato está preparado
2. **Pergunta 1** — Pergunta sobre a motivação do candidato para concorrer a esta bolsa específica
3. **Pergunta 2** — Pergunta sobre a formação académica e como se relaciona com a bolsa
4. **Pergunta 3** — Pergunta sobre a experiência profissional ou extracurricular relevante
5. **Pergunta 4** — Pergunta sobre os objectivos académicos e profissionais futuros
6. **Pergunta 5** — Pergunta sobre como o candidato pretende contribuir para a comunidade após a formação
7. **Pergunta 6** — Pergunta sobre desafios que o candidato já superou e como isso o prepara para esta oportunidade
8. **Encerramento** — Agradece a participação e pergunta se o candidato tem alguma dúvida ou gostaria de finalizar

Faz UMA pergunta de cada vez. Aguarda a resposta do candidato antes de prosseguir.`;
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

export const entrevistaBolsa = async (
  req: FastifyRequest,
  res: FastifyReply,
) => {
  try {
    const { bolsaId, mensagem, historico, finalizar, perfilAcademico } = entrevistaSchema.parse(req.body);
    const openai = getOpenAI();

    const bolsa = await prisma.bolsa.findUnique({
      where: { id: bolsaId },
    });

    if (!bolsa) {
      return res.status(404).send({
        error: "Not Found",
        message: "Bolsa não encontrada.",
      });
    }

    const systemPrompt = construirSystemPrompt(bolsa, perfilAcademico, finalizar);

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
      || "Desculpe, não consegui processar a sua resposta. Pode repetir?";

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
        message: "O entrevistador IA ainda não foi configurado. Contacte o administrador.",
      });
    }

    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao processar entrevista.",
    });
  }
};
