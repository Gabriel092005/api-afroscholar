import { FetchNovidadesUseCase } from "@/use-cases/fetch-novidades-use-case";
import { FastifyReply, FastifyRequest } from "fastify";

export async function fetchNovidadesController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { destaque?: string; status?: string };
    const fetchUseCase = new FetchNovidadesUseCase();

    const params: any = {};
    if (query.destaque === "true") params.destaque = true;
    if (query.status) params.status = query.status;

    const { novidades } = await fetchUseCase.execute(params);

    return reply.status(200).send(novidades);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ message: "Erro ao buscar novidades" });
  }
}
