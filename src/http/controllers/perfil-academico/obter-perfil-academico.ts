import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

function toArray(val: any): string[] {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") return val.split(",").filter(Boolean);
  return [];
}

function calcularAfroScore(perfil: Record<string, any>) {
  let score = 0;
  const maxScore = 100;
  const pontosFortes: string[] = [];
  const pontosMelhorar: string[] = [];

  // ── Formação Académica (max 25) ──
  if (perfil.nivelEnsino) { score += 5; pontosFortes.push("Nível de ensino definido"); }
  else pontosMelhorar.push("Falta definir o nível de ensino");
  if (perfil.instituicao) { score += 5; pontosFortes.push("Instituição de ensino registada"); }
  else pontosMelhorar.push("Falta registar a instituição de ensino");
  if (perfil.curso) { score += 5; pontosFortes.push("Curso registado"); }
  else pontosMelhorar.push("Falta registar o curso");
  if (perfil.media) {
    const m = parseFloat(perfil.media.replace(",", "."));
    if (!isNaN(m)) {
      if (m >= 16) { score += 8; pontosFortes.push("Média excelente"); }
      else if (m >= 14) { score += 6; pontosFortes.push("Boa média"); }
      else if (m >= 10) { score += 4; pontosFortes.push("Média positiva"); }
      else { score += 1; pontosMelhorar.push("Média baixa"); }
    }
  } else pontosMelhorar.push("Falta registar a média");
  if (perfil.anoConclusao) { score += 2; }

  // ── Competências Linguísticas (max 20) ──
  if (perfil.idiomas) {
    const langs = perfil.idiomas.toLowerCase();
    score += 5;
    if (langs.includes("avançado") || langs.includes("avancado") || langs.includes("fluente") || langs.includes("nativo")) {
      score += 3;
      pontosFortes.push("Nível avançado em língua estrangeira");
    }
  } else pontosMelhorar.push("Falta registar competências linguísticas");
  const certs = toArray(perfil.certificadosIdiomas);
  if (certs.length > 0) {
    score += Math.min(certs.length * 4, 12);
    pontosFortes.push(`${certs.length} certificado(s) de idioma`);
  } else pontosMelhorar.push("Falta certificado de idioma (TOEFL, IELTS, etc.)");

  // ── Experiência Profissional (max 15) ──
  const hasExp = perfil.experienciaProfissional || perfil.historicoProfissional;
  if (hasExp) { score += 5; pontosFortes.push("Experiência profissional registada"); }
  else pontosMelhorar.push("Falta experiência profissional");
  if (perfil.areaActuacao && perfil.cargoOcupado) { score += 5; pontosFortes.push("Área de actuação e cargo definidos"); }
  else pontosMelhorar.push("Falta definir área de actuação ou cargo");
  const ativs = toArray(perfil.atividadesExtracurriculares);
  if (ativs.length > 0) {
    score += Math.min(ativs.length * 2, 5);
    if (ativs.includes("VOLUNTARIADO")) pontosFortes.push("Experiência em voluntariado");
    if (ativs.includes("LIDERANCA_ESTUDANTIL")) pontosFortes.push("Experiência em liderança estudantil");
    if (ativs.includes("MONITORIA")) pontosFortes.push("Experiência em monitoria");
    if (ativs.includes("PESQUISA_CIENTIFICA")) pontosFortes.push("Experiência em pesquisa científica");
    if (ativs.includes("EMPREENDEDORISMO")) pontosFortes.push("Experiência em empreendedorismo");
    if (ativs.includes("PROJECTOS_SOCIAIS")) pontosFortes.push("Participação em projectos sociais");
  } else pontosMelhorar.push("Falta experiência extra-curricular (voluntariado, liderança, etc.)");

  // ── Produção Científica (max 15) ──
  const prods = toArray(perfil.producaoCientifica);
  if (prods.length > 0) {
    score += Math.min(prods.length * 3, 10);
    pontosFortes.push("Produção científica registada");
  } else pontosMelhorar.push("Falta produção científica (artigos, resumos, etc.)");
  if (perfil.descricaoProducao) { score += 5; }

  // ── Documentos (max 10) ──
  const docs = toArray(perfil.documentos);
  if (docs.length > 0) {
    score += Math.min(docs.length * 2, 10);
    if (docs.includes("PASSAPORTE")) pontosFortes.push("Passaporte disponível");
    if (docs.includes("CURRICULO")) pontosFortes.push("Currículo disponível");
    if (docs.includes("CARTA_MOTIVACAO")) pontosFortes.push("Carta de motivação disponível");
    if (docs.includes("CARTAS_RECOMENDACAO")) pontosFortes.push("Cartas de recomendação disponíveis");
  } else pontosMelhorar.push("Falta registar documentos (passaporte, currículo, etc.)");

  // ── Motivação e Objectivos (max 10) ──
  if (perfil.motivacoes) { score += 4; pontosFortes.push("Motivações registadas"); }
  else pontosMelhorar.push("Falta registar motivações");
  if (perfil.objetivosAcademicos) { score += 3; }
  else pontosMelhorar.push("Falta definir objectivos académicos");
  if (perfil.areaInteresse) { score += 3; }

  // ── Mobilidade (max 5) ──
  if (perfil.mudarPais === "SIM") { score += 3; pontosFortes.push("Disponibilidade para mudar de país"); }
  if (perfil.qualquerContinente === "SIM") { score += 2; }

  return { score: Math.min(score, maxScore), maxScore, pontosFortes, pontosMelhorar };
}

function calcularCompletudePerfil(perfil: Record<string, any>): number {
  const fields: { key: string; type: "string" | "array" }[] = [
    { key: "dataNascimento", type: "string" },
    { key: "genero", type: "string" },
    { key: "nacionalidade", type: "string" },
    { key: "pais", type: "string" },
    { key: "provincia", type: "string" },
    { key: "municipio", type: "string" },
    { key: "whatsapp", type: "string" },
    { key: "nivelEnsino", type: "string" },
    { key: "instituicao", type: "string" },
    { key: "curso", type: "string" },
    { key: "nivel", type: "string" },
    { key: "anoConclusao", type: "string" },
    { key: "media", type: "string" },
    { key: "areaInteresse", type: "array" },
    { key: "cursoDesejado", type: "string" },
    { key: "quandoPretendeIniciar", type: "string" },
    { key: "objetivosAcademicos", type: "string" },
    { key: "idiomas", type: "string" },
    { key: "certificadosIdiomas", type: "array" },
    { key: "areaActuacao", type: "string" },
    { key: "cargoOcupado", type: "string" },
    { key: "historicoProfissional", type: "string" },
    { key: "experienciaProfissional", type: "string" },
    { key: "atividadesExtracurriculares", type: "array" },
    { key: "descricaoAtividades", type: "string" },
    { key: "producaoCientifica", type: "array" },
    { key: "descricaoProducao", type: "string" },
    { key: "bolsaIntegral", type: "string" },
    { key: "bolsaParcial", type: "string" },
    { key: "custeiaPassagem", type: "string" },
    { key: "preferenciaDestino", type: "string" },
    { key: "mudarPais", type: "string" },
    { key: "qualquerContinente", type: "string" },
    { key: "documentos", type: "array" },
    { key: "motivacoes", type: "string" },
  ];
  const filled = fields.filter((f) => {
    const val = perfil[f.key];
    if (f.type === "array") return Array.isArray(val) && val.length > 0;
    return typeof val === "string" && val.trim() !== "";
  }).length;
  return Math.round((filled / fields.length) * 100);
}

export async function obterPerfilAcademico(request: FastifyRequest, reply: FastifyReply) {
  try {
    const perfil = await prisma.perfilAcademico.findUnique({
      where: { usuarioId: request.user.sub },
    });

    const afroScore = perfil ? calcularAfroScore(perfil) : null;
    const completude = perfil ? calcularCompletudePerfil(perfil) : 0;

    return reply.send({ perfil, afroScore, completude });
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ message: "Erro ao obter perfil académico" });
  }
}
