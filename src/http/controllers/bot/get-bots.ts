
import { EstadoBot, GetBotsAdminUseCase } from "@/use-cases/admin-bots-page";
import { FastifyReply, FastifyRequest } from "fastify";


export const getBotsAdmin = async (
  req: FastifyRequest<{ 
    Querystring: { 
      search?: string; 
      estado?: EstadoBot 
    } 
  }>, 
  res: FastifyReply
) => {
  const useCase = new GetBotsAdminUseCase();

  try {
    // 1. Capturar filtros da query string (?search=...&estado=...)
    const { search, estado } = req.query;

    // 2. Executar o Use Case passando os filtros
    const data = await useCase.execute({ search, estado });

    // 3. Retornar resposta com status 200
    return res.status(200).send(data);
  } catch (error) {
    // Mantendo o padrão de log performático do Fastify
    req.log.error(error);

    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao carregar a lista de bots administrativos."
    });
  }
};