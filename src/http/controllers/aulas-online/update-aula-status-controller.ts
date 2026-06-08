import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const updateAulaSchema = z.object({
  status: z.enum(["AGENDADA", "AO_VIVO", "FINALIZADA", "CANCELADA"]).optional(),
  gravacaoUrl: z.string().url("URL inválida").optional().nullable(),
});

export async function updateAulaStatus(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const body = updateAulaSchema.parse(req.body);
    const userId = req.user.sub;

    const aula = await prisma.aulaOnline.findUnique({ where: { id } });

    if (!aula) {
      return res.status(404).send({ error: "Not Found", message: "Aula não encontrada." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    if (aula.hostId !== userId && (!user || user.role !== "ADMIN")) {
      return res.status(403).send({ error: "Forbidden", message: "Apenas o anfitrião pode alterar o status." });
    }

    const data: any = {};
    if (body.status) data.status = body.status;
    if (body.gravacaoUrl !== undefined) data.gravacaoUrl = body.gravacaoUrl;

    const updated = await prisma.aulaOnline.update({
      where: { id },
      data,
    });

    return res.send(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao atualizar aula." });
  }
}
