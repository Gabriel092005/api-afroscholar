import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listMentorias(req: FastifyRequest, res: FastifyReply) {
  try {
    const userId = req.user.sub;
    const { bolsaId } = req.query as { bolsaId?: string };

    const where = bolsaId ? { bolsaId } : {};

    const mentorias = await prisma.mentoria.findMany({
      where,
      include: {
        _count: { select: { aulas: true, inscricoes: true } },
        inscricoes: {
          where: { usuarioId: userId },
          select: { status: true },
        },
        bolsa: {
          select: { id: true, titulo: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const data = mentorias.map((m) => ({
      ...m,
      inscrito: m.inscricoes.length > 0 ? m.inscricoes[0].status : null,
      inscricoes: undefined,
    }));

    return res.send({ data });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar mentorias." });
  }
}