import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function inscreverMentoria(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const usuarioId = req.user.sub;

    const mentoria = await prisma.mentoria.findUnique({ where: { id } });

    if (!mentoria) {
      return res.status(404).send({ error: "Not Found", message: "Mentoria não encontrada." });
    }

    const existing = await prisma.mentoriaInscricao.findUnique({
      where: { mentoriaId_usuarioId: { mentoriaId: id, usuarioId } },
    });

    if (existing) {
      return res.send({ message: "Já está inscrito nesta mentoria." });
    }

    const inscricao = await prisma.mentoriaInscricao.create({
      data: { mentoriaId: id, usuarioId },
    });

    return res.status(201).send(inscricao);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao inscrever na mentoria." });
  }
}
