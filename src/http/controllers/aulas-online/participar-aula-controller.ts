import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function participarAula(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const usuarioId = req.user.sub;

    const aula = await prisma.aulaOnline.findUnique({ where: { id } });

    if (!aula) {
      return res.status(404).send({ error: "Not Found", message: "Aula não encontrada." });
    }

    const user = await prisma.user.findUnique({ where: { id: usuarioId }, select: { role: true } });

    if (user && user.role !== "ADMIN" && user.role !== "GESTOR" && aula.hostId !== usuarioId && aula.bolsaId) {
      const inscricao = await prisma.bolsaInscricao.findFirst({
        where: {
          bolsaId: aula.bolsaId,
          usuarioId,
          status: "APROVADA",
        },
      });

      if (!inscricao) {
        return res.status(403).send({
          error: "Forbidden",
          message: "É necessário estar inscrito na bolsa desta aula para participar.",
        });
      }
    }

    const existing = await prisma.aulaOnlineParticipante.findUnique({
      where: { aulaId_usuarioId: { aulaId: id, usuarioId } },
    });

    if (existing) {
      return res.send({ message: "Já está participando desta aula." });
    }

    await prisma.aulaOnlineParticipante.create({
      data: { aulaId: id, usuarioId },
    });

    return res.status(201).send({ message: "Inscrito na aula com sucesso!" });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao participar da aula." });
  }
}
