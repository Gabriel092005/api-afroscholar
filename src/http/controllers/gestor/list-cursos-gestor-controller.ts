import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listMeusCursos = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const userId = req.user.sub;
    const { search, status, page = "1", limit = "20" } = req.query as any;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const where: any = user?.role === "ADMIN" ? {} : { criadoPorId: userId };

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: "insensitive" } },
        { categoria: { contains: search, mode: "insensitive" } },
        { descricao: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "TODOS") where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [cursos, total] = await Promise.all([
      prisma.curso.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: parseInt(limit),
        include: {
          aulas: { orderBy: { ordem: "asc" } },
          bolsa: { select: { id: true, titulo: true } },
          _count: { select: { compras: true, pagamentos: true } },
        },
      }),
      prisma.curso.count({ where }),
    ]);

    return res.send({
      data: cursos,
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
      message: "Erro ao listar os seus cursos.",
    });
  }
};
