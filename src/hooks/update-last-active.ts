import { FastifyInstance } from 'fastify';
import prisma from "@/lib/prisma";

export async function RegisterLastActiveHook(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    const userId = request.user.sub 

    if (userId) {
      try {
        await prisma.usuario.update({
          where: { id: userId },
          data: { last_active_at: new Date() }
        });
      } catch (error) {
        request.log.error("Erro ao atualizar last_active_at:");
      }
    }
  });
}