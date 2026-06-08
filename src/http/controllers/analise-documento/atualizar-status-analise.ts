import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendAnaliseConcluidaEmail } from "@/lib/mail";

export async function atualizarStatusAnalise(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };

    const bodySchema = z.object({
      status: z.enum(["PENDENTE", "EM_ANALISE", "CONCLUIDO", "REJEITADO"]),
      feedback: z.string().optional(),
    });

    const body = bodySchema.parse(request.body);

    const analise = await prisma.analiseDocumento.update({
      where: { id },
      data: {
        status: body.status,
        feedback: body.feedback,
      },
    });

    if (body.status === "CONCLUIDO" || body.status === "REJEITADO") {
      const statusLabel = body.status === "CONCLUIDO" ? "Concluída" : "Rejeitada";

      await prisma.notification.create({
        data: {
          userId: analise.usuarioId,
          titulo: `Análise de Documento ${statusLabel}`,
          content: body.feedback
            ? `A análise do seu documento foi ${statusLabel.toLowerCase()}. Feedback: ${body.feedback}`
            : `A análise do seu documento foi ${statusLabel.toLowerCase()}.`,
          tipo: body.status === "CONCLUIDO" ? "CONCLUIDO" : "REJEITADO",
          entidade: "analise-documento",
          entidadeId: analise.id,
        },
      });

      sendAnaliseConcluidaEmail(
        analise.email,
        analise.nome,
        analise.tipoDocumento,
        body.status,
        body.feedback || undefined,
      );
    }

    return reply.send(analise);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation Error",
        issues: err.format(),
      });
    }
    console.error(err);
    return reply.status(500).send({ message: "Erro ao atualizar análise" });
  }
}
