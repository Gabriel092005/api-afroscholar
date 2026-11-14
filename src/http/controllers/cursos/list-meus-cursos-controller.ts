import { cursosComAcesso } from "@/lib/mentoria-acesso";
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

    const liberados = await cursosComAcesso(userId);
    const cursos = pagamentos.filter((p) => liberados.has(p.cursoId)).map((p) => p.curso);

    // Cursos abertos sem pagamento registado (acesso de monitor) também entram na lista.
    const jaListados = new Set(cursos.map((c) => c.id));
    const semPagamento = [...liberados].filter((id) => !jaListados.has(id));
    if (semPagamento.length > 0) {
      cursos.push(
        ...(await prisma.curso.findMany({
          where: { id: { in: semPagamento } },
          include: { aulas: { orderBy: { ordem: "asc" } } },
        }))
      );
    }

    return res.send(cursos);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar cursos.",
    });
  }
};