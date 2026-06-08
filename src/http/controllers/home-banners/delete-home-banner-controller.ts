import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function deleteHomeBanner(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    await prisma.homeBanner.delete({ where: { id } });
    return reply.status(200).send({ message: "Banner removido" });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ message: "Erro ao remover banner" });
  }
}
