import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listBolsasDestaques = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const bolsas = await prisma.bolsa.findMany({
      where: { status: "PUBLICADA" },
      include: {
        _count: {
          select: { inscricoes: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const destaques = bolsas.filter((b) => b._count.inscricoes >= 5);

    return res.send({ data: destaques });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar bolsas em destaque.",
    });
  }
};
