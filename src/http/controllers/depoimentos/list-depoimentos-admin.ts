import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listDepoimentosAdmin = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { status } = req.query as { status?: string };

    const where: any = {};
    if (status && status !== "todas") where.status = status;

    const depoimentos = await prisma.depoimento.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        usuario: { select: { id: true, nome: true, email: true, image_path: true } },
      },
    });

    return res.send(depoimentos);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar depoimentos.",
    });
  }
};
