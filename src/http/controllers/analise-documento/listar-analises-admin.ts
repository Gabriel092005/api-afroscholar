import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listarAnalisesAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { status } = request.query as { status?: string };

    const analises = await prisma.analiseDocumento.findMany({
      where: status ? { status } : {},
      include: {
        usuario: { select: { id: true, nome: true, email: true, image_path: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return reply.send(analises);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ message: "Erro ao listar análises" });
  }
}
