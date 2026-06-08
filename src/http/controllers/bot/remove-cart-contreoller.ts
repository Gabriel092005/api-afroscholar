// src/controllers/remove-from-cart-controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RemoveFromCartUseCase } from './remove-cart';

export async function removeFromCartController(request: FastifyRequest, reply: FastifyReply) {
  const removeParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const { id } = removeParamsSchema.parse(request.body);
  
  const usuarioId = request.user.sub; 

  try {
    const removeFromCartUseCase = new RemoveFromCartUseCase();
    await removeFromCartUseCase.execute({ 
      cartItemId: id, 
      usuarioId 
    });

    return reply.status(200).send({ message: "Bot removido com sucesso." });
  } catch (err: any) {
    return reply.status(400).send({ message: err.message });
  }
}