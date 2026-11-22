import { eMonitor, expiracaoDaMentoriaNaBolsa, socialNaBolsa, temMentoriaCompradaNaBolsa } from "@/lib/mentoria-acesso";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

/** O que o utilizador já tem nesta bolsa, para o ecrã não voltar a oferecer o mesmo. */
export const meuEstadoBolsa = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const usuarioId = req.user.sub;

    const [inscricao, mentoriaExpiraEm, monitor, comprada, social] = await Promise.all([
      prisma.bolsaInscricao.findUnique({
        where: { bolsaId_usuarioId: { bolsaId: id, usuarioId } },
        select: { inscritoEm: true },
      }),
      expiracaoDaMentoriaNaBolsa(usuarioId, id),
      eMonitor(usuarioId),
      temMentoriaCompradaNaBolsa(usuarioId, id),
      socialNaBolsa(usuarioId, id),
    ]);

    return res.send({
      inscrito: Boolean(inscricao?.inscritoEm),
      mentoriaExpiraEm,
      monitor,
      // Acesso dado pelo admin na área social, sem mentoria comprada.
      social: social && !comprada,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao verificar a sua situação nesta bolsa.",
    });
  }
};
