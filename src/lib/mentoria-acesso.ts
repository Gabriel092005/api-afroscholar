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

export async function bolsasComMentoria(usuarioId: string): Promise<string[]> {
  const acessos = await prisma.mentoriaAcesso.findMany({
    where: { usuarioId, bolsaId: { not: null }, ...ativa() },
    select: { bolsaId: true },
  });
  return acessos.map((acesso) => acesso.bolsaId as string);
}

export async function temMentoriaNaBolsa(usuarioId: string, bolsaId: string): Promise<boolean> {
  return (await prisma.mentoriaAcesso.count({ where: { usuarioId, bolsaId, ...ativa() } })) > 0;
}

/** Até quando dura a mentoria desta bolsa, se estiver ativa. */
export async function expiracaoDaMentoriaNaBolsa(usuarioId: string, bolsaId: string): Promise<Date | null> {
  const acesso = await prisma.mentoriaAcesso.findFirst({
    where: { usuarioId, bolsaId, ...ativa() },
    select: { expiraEm: true },
  });
  return acesso?.expiraEm ?? null;
}

/** O que sai do catálogo para este utilizador: já está inscrito, ou tem a mentoria a decorrer. */
export async function bolsasForaDoCatalogo(usuarioId: string): Promise<string[]> {
  const [inscritas, comMentoria] = await Promise.all([
    prisma.bolsaInscricao.findMany({
      where: { usuarioId, inscritoEm: { not: null } },
      select: { bolsaId: true },
    }),
    bolsasComMentoria(usuarioId),
  ]);
  return [...new Set([...inscritas.map((i) => i.bolsaId), ...comMentoria])];
}

export async function temMentoriaAtiva(usuarioId: string, mentoriaId: string): Promise<boolean> {
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

  return (await eStaff(usuarioId)) || temMentoriaNaBolsa(usuarioId, comunidade.bolsaId);
}

/** A IA tem custo por uso: só conta uma mentoria paga e dentro do prazo. */
export async function temMentoriaPaga(usuarioId: string): Promise<boolean> {
  return (await prisma.mentoriaAcesso.count({ where: { usuarioId, pago: true, ...ativa() } })) > 0;
}

/**
 * Cursos que o utilizador pode ver agora. O que comprou diretamente fica para sempre;
 * o que veio com a mentoria da bolsa (metodo "BOLSA") só enquanto a mentoria durar.
 */
export async function cursosComAcesso(usuarioId: string): Promise<Set<string>> {
  const [pagamentos, bolsas] = await Promise.all([
    prisma.cursoPagamento.findMany({
      where: { usuarioId, status: "APROVADO" },
      select: { cursoId: true, metodo: true, curso: { select: { bolsaId: true } } },
    }),
    bolsasComMentoria(usuarioId),
  ]);
  return new Set(
    pagamentos
      .filter((p) => p.metodo !== "BOLSA" || (p.curso.bolsaId && bolsas.includes(p.curso.bolsaId)))
      .map((p) => p.cursoId)
  );
}

/** Aula ligada a uma bolsa ou mentoria: só entra quem tem a mentoria dentro do prazo. */
export async function podeEntrarNaAula(
  usuarioId: string,
  aula: { bolsaId: string | null; mentoriaId: string | null }
): Promise<boolean> {
  if (!aula.bolsaId && !aula.mentoriaId) return true;

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
  return acessos > 0;
}
