import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listHomeBanners(request: FastifyRequest, reply: FastifyReply) {
  try {
    const banners = await prisma.homeBanner.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });
    return reply.send({ data: banners });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ message: "Erro ao listar banners" });
  }
}
