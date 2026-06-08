import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { generateJitsiToken } from "@/lib/jitsi";

export async function getAula(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user.sub;

    const aula = await prisma.aulaOnline.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, nome: true, image_path: true } },
        bolsa: { select: { id: true, titulo: true } },
        _count: { select: { participantes: true } },
      },
    });

    if (!aula) {
      return res.status(404).send({ error: "Not Found", message: "Aula não encontrada." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, nome: true, email: true, image_path: true } });

    if (user && user.role !== "ADMIN" && user.role !== "GESTOR" && aula.hostId !== userId && aula.bolsaId) {
      const inscricao = await prisma.bolsaInscricao.findFirst({
        where: {
          bolsaId: aula.bolsaId,
          usuarioId: userId,
          status: "APROVADA",
        },
      });

      if (!inscricao) {
        return res.status(403).send({
          error: "Forbidden",
          message: "É necessário estar inscrito na bolsa desta aula para aceder.",
        });
      }
    }

    const jitsiToken = generateJitsiToken(`afroscholars-${aula.roomId}`, {
      id: userId,
      nome: user?.nome || "",
      email: user?.email || "",
      image_path: user?.image_path,
    });

    return res.send({ ...aula, jitsiToken });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao buscar aula." });
  }
}
