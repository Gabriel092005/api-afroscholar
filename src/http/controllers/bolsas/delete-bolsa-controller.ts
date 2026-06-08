import { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteBolsa = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };

    const existingBolsa = await prisma.bolsa.findUnique({
      where: { id },
    });

    if (!existingBolsa) {
      return res.status(404).send({
        error: "Not Found",
        message: "Bolsa não encontrada.",
      });
    }

    await prisma.bolsa.delete({
      where: { id },
    });

    return res.status(200).send({
      message: "Bolsa eliminada com sucesso",
    });
  } catch (error) {
    req.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return res.status(409).send({
          error: "Conflict",
          message:
            "Não foi possível eliminar a bolsa pois existem inscrições vinculadas.",
        });
      }

      if (error.code === "P2025") {
        return res.status(404).send({
          error: "Not Found",
          message: "Bolsa não encontrada.",
        });
      }

      return res.status(500).send({
        error: "Internal Server Error",
        message: `Erro no banco de dados: ${error.code} — ${error.message}`,
      });
    }

    if (error instanceof Error) {
      return res.status(500).send({
        error: "Internal Server Error",
        message: error.message,
      });
    }

    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao eliminar bolsa.",
    });
  }
};