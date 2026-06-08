import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function remover(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };

    const comunidade = await prisma.community.findUnique({ where: { id } });

    if (!comunidade) {
      return res.status(404).send({ error: "Not Found", message: "Comunidade não encontrada." });
    }

    await prisma.community.delete({ where: { id } });

    return res.send({ message: "Comunidade removida com sucesso." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao remover comunidade." });
  }
}
