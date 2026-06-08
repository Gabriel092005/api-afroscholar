import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function removerResposta(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id, duvidaId, respostaId } = req.params as { id: string; duvidaId: string; respostaId: string };
    const { sub: usuarioId } = req.user;

    const resposta = await prisma.communityAnswer.findUnique({
      where: { id: respostaId },
      include: {
        duvida: {
          select: { comunidadeId: true, usuarioId: true },
        },
      },
    });

    if (!resposta) {
      return res.status(404).send({ error: "Not Found", message: "Resposta não encontrada." });
    }

    if (resposta.duvida.comunidadeId !== id || resposta.duvidaId !== duvidaId) {
      return res.status(400).send({ error: "Bad Request", message: "Resposta não pertence a esta dúvida." });
    }

    const [usuario, membro] = await Promise.all([
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { role: true },
      }),
      prisma.communityMember.findUnique({
        where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
        select: { role: true },
      }),
    ]);

    const isOwner = resposta.usuarioId === usuarioId;
    const isQuestionOwner = resposta.duvida.usuarioId === usuarioId;
    const isSystemAdmin = usuario?.role === "ADMIN";
    const isCommunityAdmin = membro?.role === "ADMIN";

    if (!isOwner && !isQuestionOwner && !isSystemAdmin && !isCommunityAdmin) {
      return res.status(403).send({ error: "Forbidden", message: "Não tem permissão para remover esta resposta." });
    }

    await prisma.communityAnswer.delete({ where: { id: respostaId } });

    return res.send({ message: "Resposta removida com sucesso." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao remover resposta." });
  }
}
