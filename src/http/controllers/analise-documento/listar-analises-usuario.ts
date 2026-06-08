import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listarAnalisesUsuario(request: FastifyRequest, reply: FastifyReply) {
  try {
    const analises = await prisma.analiseDocumento.findMany({
      where: { usuarioId: request.user.sub },
      orderBy: { created_at: "desc" },
    });

    return reply.send(analises);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ message: "Erro ao listar análises" });
  }
}
