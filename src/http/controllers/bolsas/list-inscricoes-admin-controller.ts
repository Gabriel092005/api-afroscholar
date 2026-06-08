import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listInscricoesAdmin = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { bolsaId, status, tipoInteresse } = req.query as { bolsaId?: string; status?: string; tipoInteresse?: string };

    const where: any = {};

    if (bolsaId) where.bolsaId = bolsaId;
    if (status) where.status = status;
    if (tipoInteresse) where.tipoInteresse = tipoInteresse;

    const inscricoes = await prisma.bolsaInscricao.findMany({
      where,
      include: {
        bolsa: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            phone: true,
            image_path: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return res.send(inscricoes);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar inscrições.",
    });
  }
};
