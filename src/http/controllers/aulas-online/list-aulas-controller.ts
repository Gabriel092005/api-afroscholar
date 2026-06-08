import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listAulas(req: FastifyRequest, res: FastifyReply) {
  try {
    const { page = "1", limit = "20" } = req.query as { page?: string; limit?: string };
    const skip = (Number(page) - 1) * Number(limit);

    const [aulas, total] = await Promise.all([
      prisma.aulaOnline.findMany({
        include: {
          host: { select: { id: true, nome: true, image_path: true } },
          bolsa: { select: { id: true, titulo: true } },
          _count: { select: { participantes: true } },
        },
        orderBy: { data: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.aulaOnline.count(),
    ]);

    return res.send({ data: aulas, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar aulas." });
  }
}
