import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listAtividades(_req: FastifyRequest, res: FastifyReply) {
  try {
    const atividades = await prisma.atividade.findMany({
      include: {
        criadoPor: { select: { id: true, nome: true } },
      },
      orderBy: { data: "asc" },
    });

    return res.send({ data: atividades });
  } catch (error) {
    _req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar atividades." });
  }
}
