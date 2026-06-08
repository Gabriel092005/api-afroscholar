import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listUsuarios = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { search, role, estado, page = "1", limit = "20" } = req.query as any;

    const where: any = {};

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) where.role = role;
    if (estado) where.estado_conta = estado;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          estado_conta: true,
          image_path: true,
          created_at: true,
          last_active_at: true,
          phone: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return res.send({
      data: users,
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
      message: "Erro ao listar utilizadores.",
    });
  }
};
