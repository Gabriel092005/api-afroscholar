import { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteCurso = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  res: FastifyReply
) => {
  try {
    const { id } = req.params;

    const existingCurso = await prisma.curso.findUnique({
      where: { id },
    });

    if (!existingCurso) {
      return res.status(404).send({
        error: "Not Found",
        message: "Curso não encontrado.",
      });
    }

    await prisma.curso.delete({
      where: { id },
    });

    return res.status(200).send({
      message: "Curso excluído com sucesso",
    });
  } catch (error) {
    req.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return res.status(409).send({
          error: "Conflict",
          message:
            "Não foi possível excluir o curso pois existem registros dependentes (pagamentos ou matrículas). Entre em contato com o suporte.",
        });
      }

      if (error.code === "P2025") {
        return res.status(404).send({
          error: "Not Found",
          message: "Curso não encontrado.",
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
      message: "Erro ao excluir curso.",
    });
  }
};
