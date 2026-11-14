import jwt from "jsonwebtoken";
import { env } from "@/Env";
import { detalheDaVenda } from "@/lib/atendimento";
import { emailEstaConfigurado, enviarEmailMarketing } from "@/lib/mail";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-service";

/**
 * Funil de vendas por email. Corre uma vez por dia de manhã e manda a cada utilizador,
 * no máximo, UM email: o do gatilho mais importante para ele nesse dia.
 *
 * Prioridade (o primeiro que se aplicar ganha):
 *   1. PAGAMENTO_ABANDONADO — começou a pagar e não terminou (últimas 72h).
 *   2. MENTORIA_A_EXPIRAR   — a mentoria paga acaba nos próximos 3 dias.
 *   3. MENTORIA_EXPIRADA    — a mentoria acabou há 1 a 7 dias e não renovou.
 *   4. BOAS_VINDAS          — sequência dos dias 1, 3 e 7 para quem ainda não comprou.
 *   5. PRAZO_BOLSA          — uma bolsa publicada fecha em 3 a 14 dias (urgência).
 *   6. REATIVACAO           — não entra há 14+ dias (no máximo uma vez por mês).
 *
 * Os gatilhos 4 a 6 são promocionais: no máximo um a cada 3 dias por pessoa.
 * A tabela emails_funil guarda o que saiu, para nunca repetir o mesmo gatilho.
 */

export type Gatilho =
  | "PAGAMENTO_ABANDONADO"
  | "MENTORIA_A_EXPIRAR"
  | "MENTORIA_EXPIRADA"
  | "BOAS_VINDAS"
  | "PRAZO_BOLSA"
  | "REATIVACAO"
  | "RECOMENDACOES";

const PROMOCIONAIS: Gatilho[] = ["BOAS_VINDAS", "PRAZO_BOLSA", "REATIVACAO"];
const DIAS_ENTRE_PROMOCIONAIS = 3;
const PASSOS_BOAS_VINDAS = [1, 3, 7] as const;
/** Um passo de boas-vindas só sai até 2 dias depois do dia certo (contas antigas não recebem a sequência). */
const JANELA_BOAS_VINDAS_DIAS = 2;
/** Os servidores SMTP (ex.: Gmail) limitam os envios diários; o resto fica para o dia seguinte. */
const MAXIMO_POR_EXECUCAO = 400;
const PAUSA_ENTRE_EMAILS_MS = 400;

const DIA_MS = 24 * 60 * 60 * 1000;
const haDias = (dias: number) => new Date(Date.now() - dias * DIA_MS);
const daquiADias = (dias: number) => new Date(Date.now() + dias * DIA_MS);
const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || "olá";
const formatarData = (data: Date) =>
  data.toLocaleDateString("pt-PT", { timeZone: "Africa/Luanda", day: "numeric", month: "long" });
const link = (caminho: string) => `${env.FRONTEND_URL}${caminho}`;

type Destinatario = { id: string; nome: string; email: string };

type EmailPlaneado = {
  usuario: Destinatario;
  gatilho: Gatilho;
  chave: string;
  assunto: string;
  titulo: string;
  resumo: string;
  paragrafos: string[];
  lista?: string[];
  destaque?: { titulo: string; texto: string };
  botao: { texto: string; href: string };
};

/** Quem pode receber: utilizadores normais, activos e que não cancelaram a subscrição. */
const ondeElegivel = {
  role: "USUARIO" as const,
  estado_conta: "ACTIVA" as const,
  recebeEmailsMarketing: true,
};

// ─── Cancelar subscrição ───────────────────────────────────────────

const TIPO_TOKEN = "cancelar-emails";

export function linkCancelarSubscricao(usuarioId: string) {
  const token = jwt.sign({ tipo: TIPO_TOKEN }, env.JWT_SECRET, { subject: usuarioId });
  return `${env.API_URL}/emails/cancelar?token=${encodeURIComponent(token)}`;
}

/** Devolve o id do utilizador se o token for válido, ou null. */
export function lerTokenCancelamento(token: string): string | null {
  try {
    const dados = jwt.verify(token, env.JWT_SECRET) as { tipo?: string; sub?: string };
    return dados.tipo === TIPO_TOKEN && dados.sub ? dados.sub : null;
  } catch {
    return null;
  }
}

// ─── Gatilhos ──────────────────────────────────────────────────────

async function pagamentosAbandonados(): Promise<EmailPlaneado[]> {
  const pagamentos = await prisma.pagamentoMomenu.findMany({
    where: {
      status: { in: ["FALHADO", "PENDENTE"] },
      // Dá pelo menos 1h para o pagamento por referência poder ser feito.
      created_at: { gte: haDias(3), lte: new Date(Date.now() - 60 * 60 * 1000) },
      usuario: ondeElegivel,
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      tipo: true,
      alvoId: true,
      valor: true,
      created_at: true,
      usuario: { select: { id: true, nome: true, email: true } },
    },
  });

  const planeados: EmailPlaneado[] = [];
  const vistos = new Set<string>();
  for (const p of pagamentos) {
    if (!p.usuario || vistos.has(p.usuario.id)) continue;
    vistos.add(p.usuario.id);
    // Se entretanto pagou alguma coisa, não insistimos.
    const pagouDepois = await prisma.pagamentoMomenu.count({
      where: { usuarioId: p.usuario.id, status: "PAGO", created_at: { gte: p.created_at } },
    });
    if (pagouDepois > 0) continue;

    const detalhe = await detalheDaVenda(p);
    const nome = primeiroNome(p.usuario.nome);
    planeados.push({
      usuario: p.usuario,
      gatilho: "PAGAMENTO_ABANDONADO",
      chave: p.id,
      assunto: `${nome}, a sua vaga ainda está reservada`,
      titulo: "Ficou a um passo",
      resumo: "O seu pagamento não chegou a ser concluído. Termine em 2 minutos.",
      paragrafos: [
        `Olá, ${nome}! Reparámos que começou a inscrição em ${detalhe.produto}, mas o pagamento não foi concluído.`,
        "Acontece: a rede falha, a referência expira, o telemóvel bloqueia. Guardámos tudo para continuar exactamente onde parou.",
      ],
      destaque: {
        titulo: "Porque vale a pena terminar hoje",
        texto: "As bolsas têm prazos e vagas limitadas. Quem começa a preparação mais cedo chega à candidatura com mais confiança.",
      },
      botao: { texto: "Concluir a minha inscrição", href: link(detalhe.caminho) },
    });
  }
  return planeados;
}

async function mentoriasAExpirar(): Promise<EmailPlaneado[]> {
  const acessos = await prisma.mentoriaAcesso.findMany({
    where: { pago: true, expiraEm: { gt: new Date(), lte: daquiADias(3) }, usuario: ondeElegivel },
    select: {
      id: true,
      expiraEm: true,
      bolsaId: true,
      bolsa: { select: { titulo: true } },
      mentoria: { select: { nome: true, bolsaId: true } },
      usuario: { select: { id: true, nome: true, email: true } },
    },
  });

  return acessos.map((a) => {
    const nome = primeiroNome(a.usuario.nome);
    const titulo = a.bolsa?.titulo ?? a.mentoria?.nome ?? "a sua bolsa";
    const bolsaId = a.bolsaId ?? a.mentoria?.bolsaId;
    return {
      usuario: a.usuario,
      gatilho: "MENTORIA_A_EXPIRAR" as const,
      chave: `${a.id}:${a.expiraEm.toISOString().slice(0, 10)}`,
      assunto: `${nome}, a sua mentoria termina a ${formatarData(a.expiraEm)}`,
      titulo: "Não perca o acesso",
      resumo: `A mentoria de ${titulo} está quase a terminar. Renove e continue sem interrupções.`,
      paragrafos: [
        `Olá, ${nome}! A sua mentoria de "${titulo}" termina a ${formatarData(a.expiraEm)}.`,
        "Quando terminar, perde o acesso a estes conteúdos:",
      ],
      lista: [
        "Cursos de preparação da bolsa",
        "Comunidade com outros candidatos",
        "Aulas ao vivo com os mentores",
        "Inteligência artificial para entrevistas e candidatura",
      ],
      destaque: {
        titulo: "Renove antes do fim",
        texto: "Se renovar agora, o tempo novo soma-se ao que ainda lhe resta: não perde nenhum dia.",
      },
      botao: { texto: "Renovar a mentoria", href: link(bolsaId ? `/bolsas/${bolsaId}?servico=mentoria` : "/bolsas") },
    };
  });
}

async function mentoriasExpiradas(): Promise<EmailPlaneado[]> {
  const acessos = await prisma.mentoriaAcesso.findMany({
    where: { expiraEm: { gte: haDias(7), lte: haDias(1) }, usuario: ondeElegivel },
    select: {
      id: true,
      expiraEm: true,
      bolsaId: true,
      usuarioId: true,
      bolsa: { select: { titulo: true } },
      mentoria: { select: { nome: true, bolsaId: true } },
      usuario: { select: { id: true, nome: true, email: true } },
    },
  });

  const planeados: EmailPlaneado[] = [];
  for (const a of acessos) {
    // Quem já tem outra mentoria activa não precisa deste email.
    const ativa = await prisma.mentoriaAcesso.count({
      where: { usuarioId: a.usuarioId, expiraEm: { gt: new Date() } },
    });
    if (ativa > 0) continue;

    const nome = primeiroNome(a.usuario.nome);
    const titulo = a.bolsa?.titulo ?? a.mentoria?.nome ?? "a sua bolsa";
    const bolsaId = a.bolsaId ?? a.mentoria?.bolsaId;
    planeados.push({
      usuario: a.usuario,
      gatilho: "MENTORIA_EXPIRADA",
      chave: `${a.id}:${a.expiraEm.toISOString().slice(0, 10)}`,
      assunto: `${nome}, a sua candidatura não pode parar agora`,
      titulo: "Sentimos a sua falta na mentoria",
      resumo: `A mentoria de ${titulo} terminou. Retome a preparação de onde parou.`,
      paragrafos: [
        `Olá, ${nome}! A sua mentoria de "${titulo}" terminou há poucos dias.`,
        "O seu progresso continua guardado. Basta renovar para voltar a ter os cursos, a comunidade, as aulas ao vivo e a IA.",
      ],
      destaque: {
        titulo: "A recta final é a que decide",
        texto: "Os candidatos que mantêm a preparação até à entrega da candidatura chegam mais confiantes à entrevista.",
      },
      botao: { texto: "Retomar a mentoria", href: link(bolsaId ? `/bolsas/${bolsaId}?servico=mentoria` : "/bolsas") },
    });
  }
  return planeados;
}

/** Quem nunca teve mentoria nem pagou nada: candidatos aos emails promocionais. */
async function idsQueJaCompraram(): Promise<Set<string>> {
  const [mentorias, pagos] = await Promise.all([
    prisma.mentoriaAcesso.findMany({ select: { usuarioId: true }, distinct: ["usuarioId"] }),
    prisma.pagamentoMomenu.findMany({
      where: { status: "PAGO", usuarioId: { not: null } },
      select: { usuarioId: true },
      distinct: ["usuarioId"],
    }),
  ]);
  return new Set([...mentorias.map((m) => m.usuarioId), ...pagos.map((p) => p.usuarioId as string)]);
}

async function idsComMentoriaAtiva(): Promise<Set<string>> {
  const ativas = await prisma.mentoriaAcesso.findMany({
    where: { expiraEm: { gt: new Date() } },
    select: { usuarioId: true },
    distinct: ["usuarioId"],
  });
  return new Set(ativas.map((a) => a.usuarioId));
}

const COPY_BOAS_VINDAS: Record<(typeof PASSOS_BOAS_VINDAS)[number], (nome: string) => Omit<EmailPlaneado, "usuario" | "gatilho" | "chave">> = {
  1: (nome) => ({
    assunto: `${nome}, este é o primeiro passo para estudar lá fora`,
    titulo: "Bem-vindo à sua preparação",
    resumo: "Veja como a mentoria aumenta as suas hipóteses de ganhar uma bolsa.",
    paragrafos: [
      `Olá, ${nome}! Obrigado por se juntar à Afroscholars.`,
      "Ganhar uma bolsa internacional não é sorte: é preparação. Na mentoria tem tudo num só lugar:",
    ],
    lista: [
      "Cursos de preparação específicos para cada bolsa",
      "Mentores que já passaram pelo processo",
      "Simulação de entrevistas com inteligência artificial",
      "Uma comunidade de candidatos com o mesmo objectivo",
    ],
    botao: { texto: "Ver as bolsas abertas", href: link("/bolsas") },
  }),
  3: (nome) => ({
    assunto: `${nome}, o que separa quem ganha a bolsa de quem fica pelo caminho`,
    titulo: "O erro mais comum dos candidatos",
    resumo: "A maioria das candidaturas falha pelos mesmos motivos. Evite-os.",
    paragrafos: [
      `Olá, ${nome}! A maioria das candidaturas é recusada por motivos evitáveis: carta de motivação genérica, documentos incompletos ou uma entrevista sem preparação.`,
      "É exactamente isso que trabalhamos na mentoria, passo a passo, com quem conhece o processo por dentro.",
    ],
    destaque: {
      titulo: "Experimente a IA de entrevistas",
      texto: "Treine as perguntas mais difíceis antes do dia real e receba feedback imediato.",
    },
    botao: { texto: "Começar a minha mentoria", href: link("/bolsas") },
  }),
  7: (nome) => ({
    assunto: `${nome}, os prazos das bolsas não esperam`,
    titulo: "Uma semana depois: está pronto?",
    resumo: "Os prazos estão a correr. Garanta a sua preparação esta semana.",
    paragrafos: [
      `Olá, ${nome}! Já passou uma semana desde que criou a sua conta.`,
      "Os prazos de candidatura continuam a correr, e cada semana de preparação conta. Escolha a sua bolsa e comece hoje a mentoria.",
    ],
    destaque: {
      titulo: "Vagas limitadas",
      texto: "Cada mentoria tem um número limitado de candidatos, para os mentores poderem acompanhar cada um de perto.",
    },
    botao: { texto: "Escolher a minha bolsa", href: link("/bolsas") },
  }),
};

async function boasVindas(jaCompraram: Set<string>, enviados: Set<string>): Promise<EmailPlaneado[]> {
  const maisAntigo = PASSOS_BOAS_VINDAS[PASSOS_BOAS_VINDAS.length - 1] + JANELA_BOAS_VINDAS_DIAS + 1;
  const novos = await prisma.user.findMany({
    where: { ...ondeElegivel, created_at: { gte: haDias(maisAntigo), lte: haDias(PASSOS_BOAS_VINDAS[0]) } },
    select: { id: true, nome: true, email: true, created_at: true },
  });

  const planeados: EmailPlaneado[] = [];
  for (const u of novos) {
    if (jaCompraram.has(u.id)) continue;
    const idade = Math.floor((Date.now() - u.created_at.getTime()) / DIA_MS);
    const passo = PASSOS_BOAS_VINDAS.find(
      (d) => idade >= d && idade <= d + JANELA_BOAS_VINDAS_DIAS && !enviados.has(`${u.id}:BOAS_VINDAS:D${d}`)
    );
    if (!passo) continue;
    planeados.push({
      usuario: u,
      gatilho: "BOAS_VINDAS",
      chave: `D${passo}`,
      ...COPY_BOAS_VINDAS[passo](primeiroNome(u.nome)),
    });
  }
  return planeados;
}

async function prazosDeBolsas(comMentoria: Set<string>, enviados: Set<string>): Promise<EmailPlaneado[]> {
  const bolsas = await prisma.bolsa.findMany({
    where: { status: "PUBLICADA", prazo: { gte: daquiADias(3), lte: daquiADias(14) } },
    orderBy: { prazo: "asc" },
    select: { id: true, titulo: true, prazo: true },
  });
  if (bolsas.length === 0) return [];

  const ativos = await prisma.user.findMany({
    where: { ...ondeElegivel, last_active_at: { gte: haDias(60) } },
    select: { id: true, nome: true, email: true },
  });

  const planeados: EmailPlaneado[] = [];
  for (const u of ativos) {
    if (comMentoria.has(u.id)) continue;
    const bolsa = bolsas.find((b) => !enviados.has(`${u.id}:PRAZO_BOLSA:${b.id}`));
    if (!bolsa?.prazo) continue;
    const dias = Math.max(1, Math.ceil((bolsa.prazo.getTime() - Date.now()) / DIA_MS));
    const nome = primeiroNome(u.nome);
    planeados.push({
      usuario: u,
      gatilho: "PRAZO_BOLSA",
      chave: bolsa.id,
      assunto: `Faltam ${dias} dias: ${bolsa.titulo}`,
      titulo: `Faltam ${dias} dias para fechar`,
      resumo: `As candidaturas para ${bolsa.titulo} fecham a ${formatarData(bolsa.prazo)}.`,
      paragrafos: [
        `Olá, ${nome}! As candidaturas para "${bolsa.titulo}" fecham a ${formatarData(bolsa.prazo)}.`,
        "Ainda vai a tempo de preparar uma candidatura forte, mas o tempo está a contar. Com a mentoria tem um plano claro até à entrega.",
      ],
      destaque: {
        titulo: "Não deixe para a última hora",
        texto: "As candidaturas de última hora são as que mais erros têm. Comece hoje.",
      },
      botao: { texto: "Preparar a minha candidatura", href: link(`/bolsas/${bolsa.id}?servico=mentoria`) },
    });
  }
  return planeados;
}

async function reativacoes(comMentoria: Set<string>): Promise<EmailPlaneado[]> {
  const mes = new Date().toISOString().slice(0, 7);
  const [inativos, recentes] = await Promise.all([
    prisma.user.findMany({
      where: { ...ondeElegivel, last_active_at: { lte: haDias(14), gte: haDias(180) } },
      select: { id: true, nome: true, email: true },
    }),
    prisma.bolsa.findMany({
      where: { status: "PUBLICADA" },
      orderBy: { created_at: "desc" },
      take: 3,
      select: { titulo: true },
    }),
  ]);

  return inativos
    .filter((u) => !comMentoria.has(u.id))
    .map((u) => {
      const nome = primeiroNome(u.nome);
      return {
        usuario: u,
        gatilho: "REATIVACAO" as const,
        chave: mes,
        assunto: `${nome}, há novas oportunidades à sua espera`,
        titulo: "Há novidades para si",
        resumo: "Publicámos novas bolsas desde a sua última visita.",
        paragrafos: [
          `Olá, ${nome}! Desde a sua última visita publicámos novas oportunidades.`,
          ...(recentes.length > 0 ? ["Algumas das mais recentes:"] : []),
        ],
        lista: recentes.length > 0 ? recentes.map((b) => b.titulo) : undefined,
        botao: { texto: "Ver as novas bolsas", href: link("/bolsas") },
      };
    });
}

// ─── Recomendações diárias (engajamento) ───────────────────────────

/**
 * Todos os dias, cada pessoa recebe bolsas e cursos a que ainda não aderiu, com uma
 * mensagem motivadora diferente. É o gatilho de menor prioridade: só sai por email a
 * quem nesse dia não tiver nada mais importante. O push sai a todos (um por dia).
 */

const INTROS = [
  (n: string) => `Bom dia, ${n}! Cada dia de preparação aproxima-o da sua bolsa.`,
  (n: string) => `${n}, quem se candidata cedo tem mais tempo para preparar uma candidatura forte.`,
  (n: string) => `Olá, ${n}! O seu futuro lá fora começa com um passo hoje.`,
  (n: string) => `${n}, milhares de estudantes africanos já estudam no estrangeiro. O próximo pode ser você.`,
  (n: string) => `Bom dia, ${n}! Separámos oportunidades à medida do seu objectivo.`,
  (n: string) => `${n}, 15 minutos por dia de preparação fazem diferença na entrevista.`,
  (n: string) => `Olá, ${n}! Novas oportunidades estão à sua espera.`,
];

const ASSUNTOS = [
  (n: string, q: number) => `${n}, ${q} oportunidades escolhidas para si hoje`,
  (n: string) => `${n}, a sua próxima bolsa pode estar aqui`,
  (n: string) => `Oportunidades de hoje para ${n}`,
  (n: string) => `${n}, não deixe passar estes prazos`,
];

const DICAS = [
  { titulo: "Dica do dia", texto: "Comece a carta de motivação cedo: as melhores passam por 3 ou 4 versões." },
  { titulo: "Dica do dia", texto: "Treine a entrevista com a IA: as perguntas difíceis deixam de o surpreender." },
  { titulo: "Dica do dia", texto: "Organize os documentos (certificados, passaporte, recomendações) antes do prazo apertar." },
  { titulo: "Dica do dia", texto: "Na comunidade da bolsa pode tirar dúvidas com quem está a passar pelo mesmo." },
  { titulo: "Dica do dia", texto: "Um bom nível de inglês abre muitas portas: faça o teste de proficiência na plataforma." },
];

const hoje = () => new Date().toISOString().slice(0, 10);
const diaDoAno = () => Math.floor(Date.now() / DIA_MS);
const hashTexto = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const rodar = <T,>(lista: T[], semente: number) => lista[semente % lista.length];

type Sugestao = { bolsas: { id: string; titulo: string; prazo: Date | null }[]; cursos: { id: string; titulo: string }[] };

/** O que cada pessoa ainda não tem: bolsas sem inscrição nem mentoria, cursos não comprados. */
async function sugestoesPorUtilizador(ids: string[]): Promise<Map<string, Sugestao>> {
  const [bolsas, cursos, inscricoes, mentorias, compras] = await Promise.all([
    prisma.bolsa.findMany({
      where: { status: "PUBLICADA", OR: [{ prazo: null }, { prazo: { gte: new Date() } }] },
      orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { created_at: "desc" }],
      take: 30,
      select: { id: true, titulo: true, prazo: true },
    }),
    // Cursos de bolsa vêm com a mentoria: recomendamos os que se compram à parte.
    prisma.curso.findMany({
      where: { status: "PUBLICADO", bolsaId: null },
      orderBy: { created_at: "desc" },
      take: 30,
      select: { id: true, titulo: true },
    }),
    prisma.bolsaInscricao.findMany({ where: { usuarioId: { in: ids } }, select: { usuarioId: true, bolsaId: true } }),
    prisma.mentoriaAcesso.findMany({
      where: { usuarioId: { in: ids }, bolsaId: { not: null } },
      select: { usuarioId: true, bolsaId: true },
    }),
    prisma.cursoPagamento.findMany({
      where: { usuarioId: { in: ids }, status: "APROVADO" },
      select: { usuarioId: true, cursoId: true },
    }),
  ]);

  const temBolsa = new Set([...inscricoes, ...mentorias].map((x) => `${x.usuarioId}:${x.bolsaId}`));
  const temCurso = new Set(compras.map((x) => `${x.usuarioId}:${x.cursoId}`));
  const resultado = new Map<string, Sugestao>();

  for (const id of ids) {
    // Começa num ponto diferente por pessoa e por dia, para o conteúdo ir variando.
    const semente = diaDoAno() + hashTexto(id);
    const escolher = <T extends { id: string }>(lista: T[], jaTem: (x: T) => boolean, quantos: number) => {
      const livres = lista.filter((x) => !jaTem(x));
      if (livres.length === 0) return [];
      const inicio = semente % livres.length;
      return [...livres.slice(inicio), ...livres.slice(0, inicio)].slice(0, quantos);
    };
    resultado.set(id, {
      bolsas: escolher(bolsas, (b) => temBolsa.has(`${id}:${b.id}`), 3),
      cursos: escolher(cursos, (c) => temCurso.has(`${id}:${c.id}`), 2),
    });
  }
  return resultado;
}

async function recomendacoesDoDia(excluir: Set<string>, limite: number): Promise<EmailPlaneado[]> {
  if (limite <= 0) return [];
  const utilizadores = await prisma.user.findMany({
    where: ondeElegivel,
    select: { id: true, nome: true, email: true },
  });
  const candidatos = utilizadores
    .filter((u) => !excluir.has(u.id))
    // Ordem que muda todos os dias: com o limite diário, ninguém fica sempre de fora.
    .sort((a, b) => hashTexto(a.id + hoje()) - hashTexto(b.id + hoje()))
    .slice(0, limite);
  if (candidatos.length === 0) return [];

  const sugestoes = await sugestoesPorUtilizador(candidatos.map((u) => u.id));
  const planeados: EmailPlaneado[] = [];
  for (const u of candidatos) {
    const s = sugestoes.get(u.id);
    if (!s || (s.bolsas.length === 0 && s.cursos.length === 0)) continue;
    const nome = primeiroNome(u.nome);
    const semente = diaDoAno() + hashTexto(u.id);
    const quantos = s.bolsas.length + s.cursos.length;
    planeados.push({
      usuario: u,
      gatilho: "RECOMENDACOES",
      chave: hoje(),
      assunto: rodar(ASSUNTOS, semente)(nome, quantos),
      titulo: "As suas oportunidades de hoje",
      resumo: s.bolsas[0] ? `Em destaque: ${s.bolsas[0].titulo}` : "Cursos escolhidos para si.",
      paragrafos: [rodar(INTROS, semente)(nome), "Escolhemos para si oportunidades a que ainda não aderiu:"],
      lista: [
        ...s.bolsas.map((b) => `🎓 ${b.titulo}${b.prazo ? ` — candidaturas até ${formatarData(b.prazo)}` : ""}`),
        ...s.cursos.map((c) => `📚 Curso: ${c.titulo}`),
      ],
      destaque: rodar(DICAS, semente),
      botao: { texto: "Ver as oportunidades", href: link(s.bolsas[0] ? `/bolsas/${s.bolsas[0].id}` : "/cursos") },
    });
  }
  return planeados;
}

/** Um push por dia a cada pessoa que autorizou notificações, com a recomendação principal. */
async function pushDoDia(simulacao: boolean): Promise<number> {
  const chave = hoje();
  const [utilizadores, jaEnviados] = await Promise.all([
    prisma.user.findMany({
      where: { ...ondeElegivel, pushSubscription: { not: null } },
      select: { id: true, nome: true, pushSubscription: true },
    }),
    prisma.emailFunil.findMany({ where: { gatilho: "PUSH_DIARIO", chave }, select: { usuarioId: true } }),
  ]);
  const feitos = new Set(jaEnviados.map((j) => j.usuarioId));
  const alvo = utilizadores.filter((u) => !feitos.has(u.id));
  if (alvo.length === 0) return 0;

  const sugestoes = await sugestoesPorUtilizador(alvo.map((u) => u.id));
  let enviados = 0;
  for (const u of alvo) {
    const s = sugestoes.get(u.id);
    const bolsa = s?.bolsas[0];
    const curso = s?.cursos[0];
    if (!bolsa && !curso) continue;
    if (simulacao) {
      enviados++;
      continue;
    }
    try {
      await prisma.emailFunil.create({ data: { usuarioId: u.id, gatilho: "PUSH_DIARIO", chave } });
    } catch {
      continue;
    }
    const nome = primeiroNome(u.nome);
    await PushService.entregar(u.id, u.pushSubscription, {
      title: bolsa ? `🎓 ${bolsa.titulo}` : `📚 ${curso!.titulo}`,
      body: bolsa?.prazo
        ? `${nome}, as candidaturas fecham a ${formatarData(bolsa.prazo)}. Prepare-se hoje!`
        : rodar(INTROS, diaDoAno() + hashTexto(u.id))(nome),
      url: bolsa ? `/bolsas/${bolsa.id}` : `/cursos/${curso!.id}`,
      tag: "recomendacao-diaria",
    });
    enviados++;
  }
  return enviados;
}

// ─── Execução ──────────────────────────────────────────────────────

export type ResultadoFunil = {
  /** Pushes diários de recomendações (um por pessoa por dia). */
  pushes: number;
  planeados: number;
  enviados: number;
  falhados: number;
  porGatilho: Partial<Record<Gatilho, number>>;
  /** Execução de simulação: nada foi enviado nem registado. */
  simulacao: boolean;
};

/**
 * Calcula quem recebe o quê hoje e envia. Com `simulacao`, só devolve as contagens.
 */
export async function executarFunil({ simulacao = false } = {}): Promise<ResultadoFunil> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const [historico, jaCompraram, comMentoria] = await Promise.all([
    prisma.emailFunil.findMany({
      where: {
        OR: [
          { gatilho: { in: ["BOAS_VINDAS", "PRAZO_BOLSA", "REATIVACAO"] } },
          // Os outros gatilhos têm janelas de poucos dias: 30 dias de histórico chegam.
          { enviadoEm: { gte: haDias(30) } },
        ],
      },
      select: { usuarioId: true, gatilho: true, chave: true, enviadoEm: true },
    }),
    idsQueJaCompraram(),
    idsComMentoriaAtiva(),
  ]);

  const enviados = new Set(historico.map((h) => `${h.usuarioId}:${h.gatilho}:${h.chave}`));
  const recebeuHoje = new Set(historico.filter((h) => h.enviadoEm >= inicioDoDia).map((h) => h.usuarioId));
  const promocionalRecente = new Set(
    historico
      .filter((h) => PROMOCIONAIS.includes(h.gatilho as Gatilho) && h.enviadoEm >= haDias(DIAS_ENTRE_PROMOCIONAIS))
      .map((h) => h.usuarioId)
  );

  // Por ordem de prioridade: o primeiro email planeado para cada pessoa é o que sai.
  const candidatos = [
    ...(await pagamentosAbandonados()),
    ...(await mentoriasAExpirar()),
    ...(await mentoriasExpiradas()),
    ...(await boasVindas(jaCompraram, enviados)),
    ...(await prazosDeBolsas(comMentoria, enviados)),
    ...(await reativacoes(comMentoria)),
  ];

  const plano: EmailPlaneado[] = [];
  const escolhidos = new Set<string>();
  for (const c of candidatos) {
    const id = c.usuario.id;
    if (escolhidos.has(id) || recebeuHoje.has(id)) continue;
    if (enviados.has(`${id}:${c.gatilho}:${c.chave}`)) continue;
    if (PROMOCIONAIS.includes(c.gatilho) && promocionalRecente.has(id)) continue;
    escolhidos.add(id);
    plano.push(c);
    if (plano.length >= MAXIMO_POR_EXECUCAO) break;
  }

  // Quem não tem nada mais importante hoje recebe as recomendações do dia.
  const jaTemEmailHoje = new Set([...escolhidos, ...recebeuHoje]);
  for (const r of await recomendacoesDoDia(jaTemEmailHoje, MAXIMO_POR_EXECUCAO - plano.length)) {
    if (enviados.has(`${r.usuario.id}:${r.gatilho}:${r.chave}`)) continue;
    escolhidos.add(r.usuario.id);
    plano.push(r);
  }

  const porGatilho: Partial<Record<Gatilho, number>> = {};
  for (const p of plano) porGatilho[p.gatilho] = (porGatilho[p.gatilho] ?? 0) + 1;

  if (simulacao) {
    return { pushes: await pushDoDia(true), planeados: plano.length, enviados: 0, falhados: 0, porGatilho, simulacao };
  }

  let enviadosOk = 0;
  let falhados = 0;
  for (const p of plano) {
    // Regista primeiro (a chave única evita duplicados se duas execuções se cruzarem).
    try {
      await prisma.emailFunil.create({ data: { usuarioId: p.usuario.id, gatilho: p.gatilho, chave: p.chave } });
    } catch {
      continue;
    }
    const ok = await enviarEmailMarketing(p.usuario.email, p.assunto, {
      titulo: p.titulo,
      resumo: p.resumo,
      paragrafos: p.paragrafos,
      lista: p.lista,
      destaque: p.destaque,
      botao: p.botao,
      cancelarSubscricao: linkCancelarSubscricao(p.usuario.id),
    });
    if (ok) {
      enviadosOk++;
    } else {
      falhados++;
      // Não saiu: apaga o registo para tentar outra vez amanhã.
      await prisma.emailFunil
        .delete({ where: { usuarioId_gatilho_chave: { usuarioId: p.usuario.id, gatilho: p.gatilho, chave: p.chave } } })
        .catch(() => undefined);
    }
    await esperar(PAUSA_ENTRE_EMAILS_MS);
  }

  // O push não depende do SMTP nem do limite de emails.
  const pushes = await pushDoDia(false).catch((erro) => {
    console.error("[funil] falha nos pushes diários", erro);
    return 0;
  });
  return { pushes, planeados: plano.length, enviados: enviadosOk, falhados, porGatilho, simulacao };
}

/** Por omissão só em produção; FUNIL_EMAILS_ATIVO=true|false sobrepõe-se. */
export function funilAtivo() {
  if (env.FUNIL_EMAILS_ATIVO) return env.FUNIL_EMAILS_ATIVO === "true";
  return env.NODE_ENV === "production";
}

export { emailEstaConfigurado };
