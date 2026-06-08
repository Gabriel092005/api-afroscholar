import { DeleteNovidadeUseCase } from "@/use-cases/delete-novidade-use-case";
import { FastifyReply, FastifyRequest } from "fastify";

export async function deleteNovidadeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };

    const deleteUseCase = new DeleteNovidadeUseCase();
    await deleteUseCase.execute({ novidadeId: id });

    return reply.status(200).send({ message: "Novidade removida com sucesso" });

  } catch (err) {
    console.error(err);
    return reply.status(500).send({ message: "Erro ao remover novidade" });
  }
}
