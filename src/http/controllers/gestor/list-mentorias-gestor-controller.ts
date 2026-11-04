import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listMentoriasGestor = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const userId = req.user.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isAdmin = user?.role === "ADMIN";

    const where: any = {
      tipoInteresse: "MENTORIA",
      valorPago: { gt: 0 },
    };

    if (!isAdmin) where.bolsa = { criadoPorId: userId };

    const mentorias = await prisma.bolsaInscricao.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        valorPago: true,
        dataAgendada: true,
        created_at: true,
        nome: true,
        email: true,
        telefone: true,
        usuario: {
          select: { id: true, nome: true, email: true },
        },
        bolsa: {
          select: { id: true, titulo: true },
        },
      },
    });

    const receita = mentorias.reduce((acc, m) => acc + Number(m.valorPago ?? 0), 0);

    return res.send({
      data: mentorias,
      quantidade: mentorias.length,
      receita,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar as mentorias pagas.",
    });
  }
};
