import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listMeusCursos = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const userId = (req.user as any).sub;

    if (!userId) {
      return res.status(401).send({
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
    }

    const pagamentos = await prisma.cursoPagamento.findMany({
      where: {
        usuarioId: userId,
        status: "APROVADO",
      },
      include: {
        curso: {
          include: {
            aulas: {
              orderBy: { ordem: "asc" },
            },
          },
        },
      },
    });

    const cursos = pagamentos.map((p) => p.curso);

    return res.send(cursos);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar cursos.",
    });
  }
};