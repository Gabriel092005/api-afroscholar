import { notificar } from "@/lib/pagamentos-momenu";
import prisma from "@/lib/prisma";

/**
 * Trata as mentorias que chegaram ao fim. O acesso a cursos, documentos, aulas e IA já
 * se fecha sozinho pela data; só as comunidades guardam quem é membro, por isso saem aqui.
 */
export async function encerrarMentoriasExpiradas(limite = 100): Promise<number> {
  const expiradas = await prisma.mentoriaAcesso.findMany({
    where: { encerradoEm: null, expiraEm: { lte: new Date() } },
    take: limite,
    include: {
      bolsa: { select: { titulo: true } },
      mentoria: { select: { nome: true } },
    },
  });

  for (const acesso of expiradas) {
    if (acesso.bolsaId) {
      await prisma.communityMember.deleteMany({
        where: {
          usuarioId: acesso.usuarioId,
          role: "MEMBER",
          comunidade: { bolsaId: acesso.bolsaId },
        },
      });
    }

    // Só avisa quem ainda estava por tratar: uma renovação entretanto limpa o campo.
    const tratada = await prisma.mentoriaAcesso.updateMany({
      where: { id: acesso.id, encerradoEm: null, expiraEm: acesso.expiraEm },
      data: { encerradoEm: new Date() },
    });
    if (tratada.count === 0) continue;

    const nome = acesso.bolsa?.titulo ?? acesso.mentoria?.nome ?? "a sua bolsa";
    await notificar({
      usuarioId: acesso.usuarioId,
      titulo: "A sua mentoria terminou",
      conteudo: `O período de acesso de "${nome}" chegou ao fim. Renove a mentoria para voltar a ter os cursos, documentos, aulas ao vivo e a inteligência artificial.`,
      tipo: "INFO",
      link: acesso.bolsaId ? `/bolsas/${acesso.bolsaId}` : "/mentorias",
    });
  }

  return expiradas.length;
}
