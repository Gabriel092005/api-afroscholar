import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@/lib/prisma";

export async function listMapaGlobal(request: FastifyRequest, reply: FastifyReply) {
  const items = await prisma.mapaGlobal.findMany({
    where: { ativo: true },
    orderBy: { createdAt: "desc" },
  });
  return reply.send({ data: items });
}
