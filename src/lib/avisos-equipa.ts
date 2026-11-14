import { comunicar, comunicarPorRole } from "@/lib/comunicar";
import prisma from "@/lib/prisma";

/**
 * Avisos à equipa que acompanha os mentorandos:
 *   - mentores: quando um mentorando escreve na comunidade;
 *   - monitores: quando entra um mentorando novo numa comunidade de bolsa.
 */

const ROLES_EQUIPA = ["ADMIN", "GESTOR", "MONITOR", "ATENDIMENTO"];

/** Um email por mentor e comunidade a cada 30 minutos; app e push saem sempre. */
const INTERVALO_EMAIL_MS = 30 * 60 * 1000;
const ultimoEmail = new Map<string, number>();

/** Os mentores de uma comunidade: quem a criou, os seus administradores e o gestor da bolsa. */
async function mentoresDaComunidade(comunidadeId: string): Promise<string[]> {
  const comunidade = await prisma.community.findUnique({
    where: { id: comunidadeId },
    select: {
      criador: { select: { id: true, role: true } },
      bolsa: { select: { criadoPor: { select: { id: true, role: true } } } },
      membros: {
        where: { role: "ADMIN", status: "APROVADO" },
        select: { usuario: { select: { id: true, role: true } } },
      },
    },
  });
  if (!comunidade) return [];
  const candidatos = [
    comunidade.criador,
    comunidade.bolsa?.criadoPor ?? null,
    ...comunidade.membros.map((m) => m.usuario),
  ];
  const ids = new Set<string>();
  for (const u of candidatos) {
    if (u && (u.role === "GESTOR" || u.role === "ADMIN")) ids.add(u.id);
  }
  return [...ids];
}

/**
 * Um mentorando escreveu na comunidade: os mentores recebem push e email.
 * (A notificação na app e o push aos membros já saem pelo fluxo da comunidade;
 * aqui garantimos o push a mentores que não sejam membros e o email.) Nunca lança.
 */
export async function avisarMentoresMensagemComunidade(
  comunidadeId: string,
  remetenteId: string,
  remetenteNome: string,
  conteudo: string
) {
  try {
    const remetente = await prisma.user.findUnique({ where: { id: remetenteId }, select: { role: true } });
    // Só mensagens de mentorandos (não da própria equipa).
    if (!remetente || ROLES_EQUIPA.includes(remetente.role)) return;

    const [mentores, comunidade, membros] = await Promise.all([
      mentoresDaComunidade(comunidadeId),
      prisma.community.findUnique({ where: { id: comunidadeId }, select: { nome: true } }),
      prisma.communityMember.findMany({ where: { comunidadeId }, select: { usuarioId: true } }),
    ]);
    const alvo = mentores.filter((id) => id !== remetenteId);
    if (alvo.length === 0) return;

    const membrosIds = new Set(membros.map((m) => m.usuarioId));
    const agora = Date.now();
    const resumo = conteudo.length > 160 ? `${conteudo.slice(0, 157)}…` : conteudo;

    for (const mentorId of alvo) {
      const chave = `${mentorId}:${comunidadeId}`;
      const podeEmail = agora - (ultimoEmail.get(chave) ?? 0) > INTERVALO_EMAIL_MS;
      const canais = [
        // Os membros já recebem app e push pelo fluxo normal da comunidade.
        ...(membrosIds.has(mentorId) ? [] : (["app", "push"] as const)),
        ...(podeEmail ? (["email"] as const) : []),
      ];
      if (canais.length === 0) continue;
      if (podeEmail) ultimoEmail.set(chave, agora);

      await comunicar([mentorId], {
        canais: [...canais],
        titulo: `💬 ${remetenteNome} escreveu em ${comunidade?.nome ?? "a comunidade"}`,
        conteudo: resumo,
        link: `/comunidades/${comunidadeId}`,
        entidade: "comunidade",
        entidadeId: comunidadeId,
        destaque: true,
        email: {
          assunto: `${remetenteNome} enviou uma mensagem na comunidade ${comunidade?.nome ?? ""}`.trim(),
          paragrafos: [
            `${remetenteNome} escreveu na comunidade "${comunidade?.nome ?? ""}":`,
            `"${resumo}"`,
            "Responder depressa mantém o mentorando motivado.",
          ],
          botao: "Responder na comunidade",
        },
      });
    }
  } catch (erro) {
    console.error("[avisos] falha ao avisar os mentores", erro);
  }
}

/**
 * Corre de poucos em poucos minutos: encontra mentorandos que entraram em comunidades
 * de bolsa e avisa os monitores (app, push e email) para lhes darem as boas-vindas.
 * Cada membro só é anunciado uma vez. Devolve quantos mentorandos foram anunciados.
 */
export async function avisarMonitoresNovosMentorandos(): Promise<number> {
  // Sem monitores, ninguém fica marcado: serão anunciados quando houver (até 7 dias depois).
  const monitores = await prisma.user.count({ where: { role: "MONITOR", estado_conta: "ACTIVA" } });
  if (monitores === 0) return 0;

  const novos = await prisma.communityMember.findMany({
    where: {
      status: "APROVADO",
      role: "MEMBER",
      monitoresAvisadosEm: null,
      joined_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      comunidade: { bolsaId: { not: null } },
      usuario: { role: "USUARIO" },
    },
    take: 200,
    select: {
      id: true,
      comunidadeId: true,
      comunidade: { select: { nome: true } },
      usuario: { select: { nome: true } },
    },
  });
  if (novos.length === 0) return 0;

  // Um aviso por comunidade, com todos os que entraram desde a última verificação.
  const porComunidade = new Map<string, typeof novos>();
  for (const n of novos) porComunidade.set(n.comunidadeId, [...(porComunidade.get(n.comunidadeId) ?? []), n]);

  for (const [comunidadeId, membros] of porComunidade) {
    const nomeComunidade = membros[0].comunidade.nome;
    const nomes = membros.map((m) => m.usuario.nome);
    const lista = nomes.length > 3 ? `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}` : nomes.join(", ");
    const primeiro = nomes[0].trim().split(/\s+/)[0];

    {
      await comunicarPorRole(["MONITOR"], {
        titulo:
          nomes.length === 1
            ? `👋 Novo mentorando em ${nomeComunidade}: ${nomes[0]}`
            : `👋 ${nomes.length} novos mentorandos em ${nomeComunidade}`,
        conteudo: `${lista} acabou de entrar. Dê as boas-vindas e as primeiras instruções na comunidade.`,
        tipo: "ALERTA",
        link: `/comunidades/${comunidadeId}`,
        entidade: "comunidade",
        entidadeId: comunidadeId,
        destaque: true,
        email: {
          assunto: `Novo mentorando em ${nomeComunidade}: dê as boas-vindas`,
          paragrafos: [
            `${lista} entrou na comunidade "${nomeComunidade}".`,
            "As primeiras horas contam: um bom acolhimento aumenta muito o envolvimento na mentoria. Sugestão de primeira mensagem:",
            `"Olá ${primeiro}, bem-vindo/a à comunidade! Sou monitor/a e vou acompanhar a sua preparação. Para começar: 1) veja os cursos da bolsa em Preparação Pessoal; 2) marque na agenda as próximas aulas ao vivo; 3) treine a entrevista com a IA. Conte-nos aqui qual é o seu objectivo e o prazo da candidatura!"`,
          ],
          botao: "Abrir a comunidade",
        },
      });
    }

    await prisma.communityMember.updateMany({
      where: { id: { in: membros.map((m) => m.id) } },
      data: { monitoresAvisadosEm: new Date() },
    });
  }
  return novos.length;
}
