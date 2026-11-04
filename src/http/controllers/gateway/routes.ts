import { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { serializarPagamento, sincronizarEstado } from "@/lib/pagamentos-momenu";
import { verifyJWT } from "../middleware/verify-jwt";
import { momenuWebhook } from "./webhook-momenu-controller";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function gatewayRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/pagamentos/momenu/:id",
    { onRequest: [verifyJWT] },
    async (req, reply) => {
      const parsed = paramsSchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation Error", issues: parsed.error.format() });
      }

      try {
        const pagamento = await prisma.pagamentoMomenu.findUnique({
          where: { id: parsed.data.id },
        });

        if (!pagamento || pagamento.usuarioId !== req.user.sub) {
          return reply.status(404).send({ error: "Not Found", message: "Pagamento não encontrado." });
        }

        return reply.send(serializarPagamento(await sincronizarEstado(pagamento)));
      } catch (error) {
        req.log.error(error);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    }
  );

  fastify.post("/webhooks/momenu", momenuWebhook);
}
