import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const getPagamento = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };

    const pagamento = await prisma.cursoPagamento.findUnique({
      where: { id },
      include: {
        curso: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });

    if (!pagamento) {
      return res.status(404).send({
        error: "Not Found",
        message: "Pagamento não encontrado.",
      });
    }

    return res.send(pagamento);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao buscar pagamento.",
    });
  }
};