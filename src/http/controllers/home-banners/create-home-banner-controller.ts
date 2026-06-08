import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function createHomeBanner(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { imageUrl, order } = request.body as { imageUrl: string; order?: number };
    if (!imageUrl) {
      return reply.status(400).send({ message: "imageUrl é obrigatório" });
    }
    const banner = await prisma.homeBanner.create({
      data: { imageUrl, order: order ?? 0 },
    });
    return reply.status(201).send({ data: banner });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ message: "Erro ao criar banner" });
  }
}
