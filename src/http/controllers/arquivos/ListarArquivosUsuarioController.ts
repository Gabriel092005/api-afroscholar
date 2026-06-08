import { ListarTodosArquivosUsuarioUseCase } from "@/use-cases/ListarArquivosEmpresaUseCase";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listarArquivosUsuarioController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const usuarioId = request.user.sub;

  try {
    const useCase = new ListarTodosArquivosUsuarioUseCase();
    const arquivos = await useCase.execute({ usuarioId });

    return reply.status(200).send(arquivos);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ 
      message: "Erro interno ao buscar seus arquivos." 
    });
  }
}