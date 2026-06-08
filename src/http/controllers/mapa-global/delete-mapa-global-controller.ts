import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function deleteMapaGlobal(request: FastifyRequest, reply: FastifyReply) {
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  await prisma.mapaGlobal.delete({ where: { id } });
  return reply.status(204).send();
}
