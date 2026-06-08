import { FastifyReply, FastifyRequest } from "fastify";
import { AdminDashboardService } from "./admin-dashboard";

export const getAdminDashboard = async (req: FastifyRequest, res: FastifyReply) => {
  const service = new AdminDashboardService();

  try {
    const data = await service.getDashboardData();

    return res.status(200).send(data);
  } catch (error) {
    // Usar o logger do Fastify é mais performático que console.log
    req.log.error(error); 
    
    return res.status(500).send({ 
      error: "Internal Server Error",
      message: "Erro ao carregar dados do dashboard administrativo." 
    });
  }
};