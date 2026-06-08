import { SuspendUsuarioUseCase } from "@/use-cases/suspender-usecase";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export async function suspendUsuarioController(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  });

  const { id } = paramsSchema.parse(request.params);

  try {
    const suspendUseCase = new SuspendUsuarioUseCase();
    const { user } = await suspendUseCase.execute({ id });

    return reply.status(200).send(user);
  } catch (err) {
    return reply.status(400).send({ 
      message: err instanceof Error ? err.message : "Erro ao alterar estado da conta" 
    });
  }
}
