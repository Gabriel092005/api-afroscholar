import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listar(req: FastifyRequest, res: FastifyReply) {
  try {
    const { sub: usuarioId } = req.user;
    const { bolsaId } = req.query as { bolsaId?: string };

    const where = bolsaId ? { bolsaId } : {};

    const comunidades = await prisma.community.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { membros: { where: { status: "APROVADO" } }, mensagens: true } },
        membros: {
          where: { usuarioId },
          select: { role: true, status: true },
        },
        criador: {
          select: { id: true, nome: true, image_path: true },
        },
        bolsa: {
          select: { id: true, titulo: true },
        },
      },
    });

    const comunidadesMapeadas = comunidades.map((c) => ({
      ...c,
      souMembro: c.membros.some((m) => m.status === "APROVADO"),
      solicitacaoPendente: c.membros.some((m) => m.status === "PENDENTE"),
      meuPapel: c.membros.find((m) => m.status === "APROVADO")?.role || null,
      membros: undefined,
    }));

    return res.send(comunidadesMapeadas);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar comunidades." });
  }
}
