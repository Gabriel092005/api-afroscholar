import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listParticipantes(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };

    const participantes = await prisma.aulaOnlineParticipante.findMany({
      where: { aulaId: id },
      include: {
        usuario: { select: { id: true, nome: true, email: true, image_path: true } },
      },
      orderBy: { joined_at: "desc" },
    });

    return res.send(participantes);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar participantes." });
  }
}
