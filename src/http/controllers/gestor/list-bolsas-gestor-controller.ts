import { faturacaoPorBolsa } from "@/lib/faturacao";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listMinhasBolsas = async (req: FastifyRequest, res: FastifyReply) => {
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
        { instituicao: { contains: search, mode: "insensitive" } },
        { pais: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "TODAS") where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bolsas, total] = await Promise.all([
      prisma.bolsa.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: parseInt(limit),
        include: {
          _count: { select: { inscricoes: true } },
        },
      }),
      prisma.bolsa.count({ where }),
    ]);

    const faturacao = await faturacaoPorBolsa({ id: { in: bolsas.map((b) => b.id) } });
    const faturadoPorBolsa = new Map(faturacao.map((f) => [f.id, f.total]));

    return res.send({
      data: bolsas.map((bolsa) => ({ ...bolsa, faturado: faturadoPorBolsa.get(bolsa.id) ?? 0 })),
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
      message: "Erro ao listar as suas bolsas.",
    });
  }
};
