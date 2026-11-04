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

    const acessos = await prisma.mentoriaAcesso.findMany({
      where: { usuarioId: userId, expiraEm: { gt: new Date() } },
      select: { mentoriaId: true, expiraEm: true },
    });
    const expiraPorMentoria = new Map(acessos.map((a) => [a.mentoriaId, a.expiraEm]));

    const data = mentorias.map((m) => {
      const estado = m.inscricoes[0]?.status ?? null;
      const expiraEm = expiraPorMentoria.get(m.id) ?? null;
      return {
        ...m,
        // Aprovada mas fora de prazo: volta a aparecer como disponível, para renovar.
        inscrito: estado === "APROVADA" && !expiraEm ? null : estado,
        expiraEm,
        inscricoes: undefined,
      };
    });

    return res.send({ data });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar mentorias." });
  }
}