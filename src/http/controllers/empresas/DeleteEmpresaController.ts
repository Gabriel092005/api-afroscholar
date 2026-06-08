import { DeleteEmpresaUseCase } from "@/use-cases/deletar-empresas";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";


export async function deleteEmpresaController(request: FastifyRequest, reply: FastifyReply) {
  const deleteParamsSchema = z.object({
    id: z.string().uuid(),
  });

  const { id } = deleteParamsSchema.parse(request.params);

  try {
    const deleteUseCase = new DeleteEmpresaUseCase();
    await deleteUseCase.execute({ id });

    return reply.status(204).send(); // 204 No Content para deleção bem-sucedida
  } catch (err) {
    return reply.status(400).send({ 
      message: err instanceof Error ? err.message : "Erro ao deletar empresa" 
    });
  }
}