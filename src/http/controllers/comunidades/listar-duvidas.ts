import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listarDuvidas(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };

    const duvidas = await prisma.communityQuestion.findMany({
      where: { comunidadeId: id },
      orderBy: { created_at: "desc" },
      include: {
        usuario: {
          select: { id: true, nome: true, image_path: true },
        },
        respostas: {
          orderBy: { created_at: "asc" },
          include: {
            usuario: {
              select: { id: true, nome: true, image_path: true },
            },
          },
        },
      },
    });

    return res.send(duvidas);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar dúvidas." });
  }
}
