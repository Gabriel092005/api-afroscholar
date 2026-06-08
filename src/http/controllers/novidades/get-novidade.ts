import { GetNovidadeDetailsUseCase } from "@/use-cases/get-novidade-details-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";

export async function getNovidadeDetailsController(request: FastifyRequest, reply: FastifyReply) {
  const getParamsSchema = z.object({
    id: z.string().uuid(),
  });

  try {
    const { id } = getParamsSchema.parse(request.params);

    const getDetailsUseCase = new GetNovidadeDetailsUseCase();
    const { novidade } = await getDetailsUseCase.execute({ novidadeId: id });

    return reply.status(200).send(novidade);

  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ message: "ID inválido" });
    }

    console.error(err);
    return reply.status(500).send({ message: "Erro interno ao buscar detalhes" });
  }
}
