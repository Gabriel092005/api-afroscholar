import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function deleteAula(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user.sub;

    const aula = await prisma.aulaOnline.findUnique({ where: { id } });

    if (!aula) {
      return res.status(404).send({ error: "Not Found", message: "Aula não encontrada." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    if (aula.hostId !== userId && (!user || user.role !== "ADMIN")) {
      return res.status(403).send({ error: "Forbidden", message: "Apenas o anfitrião pode remover a aula." });
    }

    await prisma.aulaOnline.delete({ where: { id } });

    return res.send({ message: "Aula removida com sucesso." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao remover aula." });
  }
}
