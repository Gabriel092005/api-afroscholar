
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AddToCartUseCase } from "@/use-cases/add-to-cart-use-case";
import { FetchCartItemsUseCase } from "@/use-cases/fetch-cart-items-use-case";

export async function addToCart(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    botId: z.string().uuid(),
    empresaId: z.string().uuid(),
    departamentoId: z.string().uuid(),
  });

  const { botId, empresaId, departamentoId } = bodySchema.parse(request.body);
  const usuarioId = request.user.sub; // ID vindo do JWT

  const useCase = new AddToCartUseCase();
  const item = await useCase.execute({ usuarioId, botId, empresaId, departamentoId });

  return reply.status(201).send(item);
}


export async function fetchCart(request: FastifyRequest, reply: FastifyReply) {
  const usuarioId = request.user.sub;
  const useCase = new FetchCartItemsUseCase();
  const itens = await useCase.execute(usuarioId);

  return reply.status(200).send(itens);
}