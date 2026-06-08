import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listPagamentos = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { status, cursoId, page = "1", limit = "10" } = req.query as any;

    const where: any = {};

    if (status) where.status = status;
    if (cursoId) where.cursoId = cursoId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [pagamentos, total] = await Promise.all([
      prisma.cursoPagamento.findMany({
        where,
        include: {
          curso: true,
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              image_path: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.cursoPagamento.count({ where }),
    ]);

    return res.send({
      data: pagamentos,
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
      message: "Erro ao listar pagamentos.",
    });
  }
};