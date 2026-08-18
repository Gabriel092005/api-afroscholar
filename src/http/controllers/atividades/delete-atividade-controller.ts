import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function deleteAtividade(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };

    const existe = await prisma.atividade.findUnique({ where: { id } });
    if (!existe) {
      return res.status(404).send({ error: "Not Found", message: "Atividade não encontrada." });
    }

    await prisma.atividade.delete({ where: { id } });

    return res.send({ ok: true });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao remover atividade." });
  }
}
