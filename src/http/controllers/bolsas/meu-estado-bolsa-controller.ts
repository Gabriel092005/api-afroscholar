import { expiracaoDaMentoriaNaBolsa } from "@/lib/mentoria-acesso";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

/** O que o utilizador já tem nesta bolsa, para o ecrã não voltar a oferecer o mesmo. */
export const meuEstadoBolsa = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const usuarioId = req.user.sub;

    const [inscricao, mentoriaExpiraEm] = await Promise.all([
      prisma.bolsaInscricao.findUnique({
        where: { bolsaId_usuarioId: { bolsaId: id, usuarioId } },
        select: { inscritoEm: true },
      }),
      expiracaoDaMentoriaNaBolsa(usuarioId, id),
    ]);

    return res.send({ inscrito: Boolean(inscricao?.inscritoEm), mentoriaExpiraEm });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao verificar a sua situação nesta bolsa.",
    });
  }
};
