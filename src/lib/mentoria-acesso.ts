import { addMonths } from "date-fns";
import type { Prisma } from "@/generated/client";
import { liberarAcessoBolsa, liberarCurso } from "@/lib/bolsa-access";
import prisma from "@/lib/prisma";

type Db = Prisma.TransactionClient;

export const DURACAO_MENTORIA_MESES = 1;

const ativa = () => ({ expiraEm: { gt: new Date() } });

/**
 * Regista o acesso de uma mentoria e abre tudo o que lhe está ligado.
 *
 * Fica numa tabela própria porque cada pessoa tem uma só inscrição por bolsa: comprar
 * depois uma consultoria reescreve essa linha, e a mentoria já paga não se pode perder.
 * Só a mentoria abre conteúdos, e pelo tempo comprado: pagar a inscrição não dá acesso a nada.
 */
export async function concederMentoria(
  alvo: { usuarioId: string; bolsaId?: string | null; mentoriaId?: string | null; pago: boolean; meses?: number | null },
  db: Db = prisma
) {
  const { usuarioId, pago } = alvo;
  const bolsaId = alvo.bolsaId ?? null;
  const mentoriaId = alvo.mentoriaId ?? null;
  const meses = alvo.meses ?? DURACAO_MENTORIA_MESES;

  const existente = await db.mentoriaAcesso.findFirst({
    where: {
      usuarioId,
      OR: [
        ...(bolsaId ? [{ bolsaId }] : []),
        ...(mentoriaId ? [{ mentoriaId }] : []),
      ],
    },
  });

  const agora = new Date();

  if (existente) {
    // Renovar antes do fim soma ao tempo que ainda falta. Quem pagou mantém esse direito.
    const inicio = existente.expiraEm > agora ? existente.expiraEm : agora;
    await db.mentoriaAcesso.update({
      where: { id: existente.id },
      data: {
        pago: (existente.expiraEm > agora && existente.pago) || pago,
        bolsaId: existente.bolsaId ?? bolsaId,
        mentoriaId: existente.mentoriaId ?? mentoriaId,
        expiraEm: addMonths(inicio, meses),
        encerradoEm: null,
      },
    });
  } else {
    await db.mentoriaAcesso.create({
      data: { usuarioId, bolsaId, mentoriaId, pago, expiraEm: addMonths(agora, meses) },
    });
  }

  if (!bolsaId) return;

  await liberarAcessoBolsa(usuarioId, bolsaId, db);

  const comunidades = await db.community.findMany({ where: { bolsaId }, select: { id: true } });
  for (const comunidade of comunidades) {
    await juntarAComunidade(comunidade.id, usuarioId, db);
  }
}

function juntarAComunidade(comunidadeId: string, usuarioId: string, db: Db) {
  return db.communityMember.upsert({
    where: { comunidadeId_usuarioId: { comunidadeId, usuarioId } },
    update: { status: "APROVADO" },
    create: { comunidadeId, usuarioId, status: "APROVADO" },
  });
}

async function mentoradosDaBolsa(bolsaId: string, db: Db) {
  return db.mentoriaAcesso.findMany({ where: { bolsaId, ...ativa() }, select: { usuarioId: true } });
}

/** Um curso ligado à bolsa depois da compra também fica aberto a quem já pagou. */
export async function liberarCursoParaMentorados(cursoId: string, bolsaId: string, db: Db = prisma) {
  for (const { usuarioId } of await mentoradosDaBolsa(bolsaId, db)) {
    await liberarCurso(usuarioId, cursoId, db);
  }
}

/** O mesmo para uma comunidade criada depois da compra. */
export async function juntarMentoradosAComunidade(comunidadeId: string, bolsaId: string, db: Db = prisma) {
  for (const { usuarioId } of await mentoradosDaBolsa(bolsaId, db)) {
    await juntarAComunidade(comunidadeId, usuarioId, db);
  }
}

export async function eStaff(usuarioId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: usuarioId }, select: { role: true } });
  return user?.role === "ADMIN" || user?.role === "GESTOR";
}

/**
 * O monitor acompanha os estudantes: vê tudo o que vê quem tem a mentoria paga, em todas
 * as bolsas e sem prazo. Não gera linhas em mentoriaAcesso; o acesso é decidido aqui.
 */
export async function eMonitor(usuarioId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: usuarioId }, select: { role: true } });
  return user?.role === "MONITOR";
}

/** Data devolvida como "fim da mentoria" a um monitor, cujo acesso não expira. */
export const ACESSO_MONITOR_ATE = new Date("9999-12-31T00:00:00.000Z");

/** O que a área social pode abrir. O admin escolhe cada um por pessoa. */
export const RECURSOS_SOCIAIS = ["documentos", "cursos", "comunidades", "aulas", "ia"] as const;
export type RecursoSocial = (typeof RECURSOS_SOCIAIS)[number];

/**
 * Membro da área social: tem o acesso de quem pagou a mentoria, mas só nas bolsas e nas
 * áreas que o admin escolheu. Como o monitor, não gera linhas em mentoriaAcesso.
 */
export async function acessoSocial(usuarioId: string) {
  return prisma.membroSocial.findFirst({
    where: { usuarioId, ativo: true, OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }] },
  });
}

type AcessoSocial = NonNullable<Awaited<ReturnType<typeof acessoSocial>>>;

/** Sem recurso indicado, basta uma das áreas estar aberta. */
function socialPermite(social: AcessoSocial, recurso?: RecursoSocial): boolean {
  return recurso ? social[recurso] : RECURSOS_SOCIAIS.some((r) => social[r]);
}

function socialAbrangeBolsa(social: AcessoSocial, bolsaId: string): boolean {
  return social.todasBolsas || social.bolsaIds.includes(bolsaId);
}

/** Bolsas que a área social abre neste recurso. */
async function bolsasSociais(usuarioId: string, recurso?: RecursoSocial): Promise<string[]> {
  const social = await acessoSocial(usuarioId);
  if (!social || !socialPermite(social, recurso)) return [];
  if (!social.todasBolsas) return social.bolsaIds;
  const bolsas = await prisma.bolsa.findMany({ select: { id: true } });
  return bolsas.map((bolsa) => bolsa.id);
}

export async function socialNaBolsa(usuarioId: string, bolsaId: string, recurso?: RecursoSocial): Promise<boolean> {
  const social = await acessoSocial(usuarioId);
  return Boolean(social && socialPermite(social, recurso) && socialAbrangeBolsa(social, bolsaId));
}

/** Bolsas com mentoria comprada e dentro do prazo (sem contar o acesso de monitor). */
async function bolsasComMentoriaComprada(usuarioId: string): Promise<string[]> {
  const acessos = await prisma.mentoriaAcesso.findMany({
    where: { usuarioId, bolsaId: { not: null }, ...ativa() },
    select: { bolsaId: true },
  });
  return acessos.map((acesso) => acesso.bolsaId as string);
}

/**
 * Bolsas onde o utilizador tem o acesso da mentoria. Com recurso, conta a área social só
 * se o admin lhe abriu esse recurso; sem recurso, basta uma área aberta.
 */
export async function bolsasComMentoria(usuarioId: string, recurso?: RecursoSocial): Promise<string[]> {
  if (await eMonitor(usuarioId)) {
    const bolsas = await prisma.bolsa.findMany({ select: { id: true } });
    return bolsas.map((bolsa) => bolsa.id);
  }
  const [compradas, sociais] = await Promise.all([
    bolsasComMentoriaComprada(usuarioId),
    bolsasSociais(usuarioId, recurso),
  ]);
  return [...new Set([...compradas, ...sociais])];
}

/** Mentoria comprada e ativa (ou monitor). Decide se pode comprar outra vez; a área social não conta. */
export async function temMentoriaCompradaNaBolsa(usuarioId: string, bolsaId: string): Promise<boolean> {
  if (await eMonitor(usuarioId)) return true;
  return (await prisma.mentoriaAcesso.count({ where: { usuarioId, bolsaId, ...ativa() } })) > 0;
}

export async function temMentoriaNaBolsa(
  usuarioId: string,
  bolsaId: string,
  recurso?: RecursoSocial
): Promise<boolean> {
  if (await temMentoriaCompradaNaBolsa(usuarioId, bolsaId)) return true;
  return socialNaBolsa(usuarioId, bolsaId, recurso);
}

/** Até quando dura a mentoria desta bolsa, se estiver ativa. */
export async function expiracaoDaMentoriaNaBolsa(usuarioId: string, bolsaId: string): Promise<Date | null> {
  if (await eMonitor(usuarioId)) return ACESSO_MONITOR_ATE;
  const acesso = await prisma.mentoriaAcesso.findFirst({
    where: { usuarioId, bolsaId, ...ativa() },
    select: { expiraEm: true },
  });
  if (acesso) return acesso.expiraEm;
  const social = await acessoSocial(usuarioId);
  if (social && socialPermite(social) && socialAbrangeBolsa(social, bolsaId)) {
    return social.expiraEm ?? ACESSO_MONITOR_ATE;
  }
  return null;
}

/**
 * O que sai do catálogo para este utilizador: já está inscrito, ou tem a mentoria a decorrer.
 * O acesso de monitor não conta, senão o catálogo ficaria vazio para ele.
 */
export async function bolsasForaDoCatalogo(usuarioId: string): Promise<string[]> {
  const [inscritas, comMentoria] = await Promise.all([
    prisma.bolsaInscricao.findMany({
      where: { usuarioId, inscritoEm: { not: null } },
      select: { bolsaId: true },
    }),
    bolsasComMentoriaComprada(usuarioId),
  ]);
  return [...new Set([...inscritas.map((i) => i.bolsaId), ...comMentoria])];
}

export async function temMentoriaAtiva(usuarioId: string, mentoriaId: string): Promise<boolean> {
  if (await eMonitor(usuarioId)) return true;
  return (await prisma.mentoriaAcesso.count({ where: { usuarioId, mentoriaId, ...ativa() } })) > 0;
}

/** Comunidade sem bolsa é aberta; a de uma bolsa é para quem tem a mentoria, já é membro ou é staff. */
export async function podeVerComunidade(
  usuarioId: string,
  comunidade: { id: string; bolsaId: string | null }
): Promise<boolean> {
  if (!comunidade.bolsaId) return true;

  const membro = await prisma.communityMember.findUnique({
    where: { comunidadeId_usuarioId: { comunidadeId: comunidade.id, usuarioId } },
    select: { status: true },
  });
  if (membro?.status === "APROVADO") return true;

  return (await eStaff(usuarioId)) || temMentoriaNaBolsa(usuarioId, comunidade.bolsaId, "comunidades");
}

/** A IA tem custo por uso: só conta uma mentoria paga e dentro do prazo. */
export async function temMentoriaPaga(usuarioId: string): Promise<boolean> {
  if (await eMonitor(usuarioId)) return true;
  if ((await prisma.mentoriaAcesso.count({ where: { usuarioId, pago: true, ...ativa() } })) > 0) return true;
  // A área social com a IA aberta conta como paga: o admin decidiu assumir esse custo.
  return Boolean((await acessoSocial(usuarioId))?.ia);
}

/**
 * Cursos que o utilizador pode ver agora. O que comprou diretamente fica para sempre;
 * o que veio com a mentoria da bolsa (metodo "BOLSA") só enquanto a mentoria durar.
 * O monitor tem também todos os cursos ligados a uma bolsa.
 */
export async function cursosComAcesso(usuarioId: string): Promise<Set<string>> {
  const [pagamentos, bolsas, monitor] = await Promise.all([
    prisma.cursoPagamento.findMany({
      where: { usuarioId, status: "APROVADO" },
      select: { cursoId: true, metodo: true, curso: { select: { bolsaId: true } } },
    }),
    bolsasComMentoria(usuarioId, "cursos"),
    eMonitor(usuarioId),
  ]);
  const liberados = new Set(
    pagamentos
      .filter((p) => p.metodo !== "BOLSA" || (p.curso.bolsaId && bolsas.includes(p.curso.bolsaId)))
      .map((p) => p.cursoId)
  );
  // Monitor e área social: os cursos das bolsas abrangidas, sem precisar de linha de pagamento.
  const cursosDeBolsa = await prisma.curso.findMany({
    where: monitor ? { bolsaId: { not: null } } : { bolsaId: { in: bolsas } },
    select: { id: true },
  });
  for (const { id } of cursosDeBolsa) liberados.add(id);
  return liberados;
}

/** Aula ligada a uma bolsa ou mentoria: só entra quem tem a mentoria dentro do prazo. */
export async function podeEntrarNaAula(
  usuarioId: string,
  aula: { bolsaId: string | null; mentoriaId: string | null }
): Promise<boolean> {
  if (!aula.bolsaId && !aula.mentoriaId) return true;
  if (await eMonitor(usuarioId)) return true;

  const mentoria = aula.mentoriaId
    ? await prisma.mentoria.findUnique({ where: { id: aula.mentoriaId }, select: { bolsaId: true } })
    : null;
  const bolsas = [aula.bolsaId, mentoria?.bolsaId].filter((id): id is string => Boolean(id));

  const acessos = await prisma.mentoriaAcesso.count({
    where: {
      usuarioId,
      ...ativa(),
      OR: [
        ...(bolsas.length > 0 ? [{ bolsaId: { in: bolsas } }] : []),
        ...(aula.mentoriaId ? [{ mentoriaId: aula.mentoriaId }] : []),
      ],
    },
  });
  if (acessos > 0) return true;

  const social = await acessoSocial(usuarioId);
  if (!social?.aulas) return false;
  // Mentoria sem bolsa só fica aberta a quem tem todas as bolsas.
  return social.todasBolsas || bolsas.some((id) => social.bolsaIds.includes(id));
}

/**
 * Junta o membro social às comunidades das bolsas abrangidas. As comunidades guardam
 * quem é membro; o resto do acesso decide-se na hora por acessoSocial.
 */
export async function juntarMembroSocialAsComunidades(usuarioId: string, db: Db = prisma) {
  const social = await db.membroSocial.findUnique({ where: { usuarioId } });
  if (!social?.ativo || !social.comunidades) return;
  const comunidades = await db.community.findMany({
    where: social.todasBolsas ? { bolsaId: { not: null } } : { bolsaId: { in: social.bolsaIds } },
    select: { id: true },
  });
  for (const comunidade of comunidades) {
    await juntarAComunidade(comunidade.id, usuarioId, db);
  }
}

/**
 * Depois de reduzir ou tirar o acesso social: sai das comunidades das bolsas que perdeu.
 * Fica onde ainda tem mentoria comprada ou acesso social, e onde é moderador/dono.
 * `antes` são as bolsas com comunidades que o acesso anterior abrangia.
 */
export async function retirarMembroSocialDasComunidades(usuarioId: string, antes: string[]) {
  if (antes.length === 0 || (await eMonitor(usuarioId))) return;
  const [compradas, sociais] = await Promise.all([
    bolsasComMentoriaComprada(usuarioId),
    bolsasSociais(usuarioId, "comunidades"),
  ]);
  const manter = new Set([...compradas, ...sociais]);
  const perdidas = antes.filter((id) => !manter.has(id));
  if (perdidas.length === 0) return;
  await prisma.communityMember.deleteMany({
    where: { usuarioId, role: "MEMBER", comunidade: { bolsaId: { in: perdidas } } },
  });
}

/** As bolsas cujas comunidades o acesso social abre agora (para comparar depois de mudar). */
export async function bolsasComunidadesSociais(usuarioId: string): Promise<string[]> {
  return bolsasSociais(usuarioId, "comunidades");
}
