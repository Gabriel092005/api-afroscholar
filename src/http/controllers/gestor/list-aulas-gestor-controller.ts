import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listMinhasAulas = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const userId = req.user.sub;
    const { page = "1", limit = "100" } = req.query as { page?: string; limit?: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const where = user?.role === "ADMIN" ? {} : { hostId: userId };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [aulas, total] = await Promise.all([
      prisma.aulaOnline.findMany({
        where,
        include: {
          host: { select: { id: true, nome: true, image_path: true } },
          bolsa: { select: { id: true, titulo: true } },
          _count: { select: { participantes: true } },
        },
        orderBy: { data: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.aulaOnline.count({ where }),
    ]);

    return res.send({
      data: aulas,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar as suas aulas.",
    });
  }
};
