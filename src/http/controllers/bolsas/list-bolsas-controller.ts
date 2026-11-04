import { bolsasForaDoCatalogo } from "@/lib/mentoria-acesso";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listBolsas = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { search, categoria, nivel, status, ocultarMinhas, page = "1", limit = "10" } = req.query as any;

    const where: any = {};

    // Só o catálogo pede isto: a entrevista e as consultorias continuam a precisar destas bolsas.
    if (ocultarMinhas === "true") {
      const usuarioId = await req
        .jwtVerify<{ sub: string }>()
        .then((token) => token.sub)
        .catch(() => null);
      if (usuarioId) where.id = { notIn: await bolsasForaDoCatalogo(usuarioId) };
    }

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: "insensitive" } },
        { instituicao: { contains: search, mode: "insensitive" } },
        { descricao: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoria) where.categoria = categoria;
    if (nivel) where.nivel = nivel;
    if (status) where.status = status;
    else where.status = { not: "INATIVA" };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bolsas, total] = await Promise.all([
      prisma.bolsa.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.bolsa.count({ where }),
    ]);

    return res.send({
      data: bolsas,
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
      message: "Erro ao listar bolsas.",
    });
  }
};