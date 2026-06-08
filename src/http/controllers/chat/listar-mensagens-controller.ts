
import { ListarMensagensUseCase } from "@/use-cases/list-messages";
import { FastifyReply, FastifyRequest } from "fastify";

export async function handleListar(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { botEmpresaId } = request.query as { botEmpresaId: string };
    const userId = request.user.sub;

    if (!botEmpresaId) {
      return reply.status(400).send({ message: "botEmpresaId é obrigatório." });
    }

    const useCase = new ListarMensagensUseCase();
    const mensagens = await useCase.execute({ botEmpresaId, usuarioId: userId });

    return reply.status(200).send(mensagens);
  } catch (err) {
    console.error("Erro ao listar mensagens:", err);
    return reply.status(400).send({
      message: "Erro ao listar mensagens",
      error: err instanceof Error ? err.message : "Erro desconhecido",
    });
  }
}