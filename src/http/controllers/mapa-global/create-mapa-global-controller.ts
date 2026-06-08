import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function createMapaGlobal(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    nome: z.string().min(1),
    curso: z.string().min(1),
    pais: z.string().min(1),
    bandeira: z.string().optional().default(""),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    imagem: z.string().optional(),
    texto: z.string().optional(),
  });

  const data = bodySchema.parse(request.body);

  const item = await prisma.mapaGlobal.create({ data });
  return reply.status(201).send({ data: item });
}
