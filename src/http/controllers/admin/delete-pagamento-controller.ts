import { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deletePagamento = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const pagamento = await prisma.cursoPagamento.findUnique({ where: { id } });
    if (!pagamento) {
      return res.status(404).send({ error: "Not Found", message: "Pagamento não encontrado." });
    }

    await prisma.cursoPagamento.delete({ where: { id } });

    return res.status(200).send({ message: "Pagamento eliminado com sucesso" });
  } catch (error) {
    req.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).send({ error: "Not Found", message: "Pagamento não encontrado." });
      }
      return res.status(500).send({
        error: "Internal Server Error",
        message: `Erro no banco de dados: ${error.code}`,
      });
    }

    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao eliminar pagamento." });
  }
};
