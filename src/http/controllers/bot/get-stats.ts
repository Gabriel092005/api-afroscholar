import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '@/lib/prisma';

export class AssinaturaStatsController {
  async handle(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const [totalAprovado, totalPendente, countPendente] = await Promise.all([
        prisma.assinatura.aggregate({
          _sum: { valorContrato: true },
          where: { status: 'APROVADO' },
        }),
        prisma.assinatura.aggregate({
          _sum: { valorContrato: true },
          where: { status: 'PENDENTE' },
        }),
        prisma.assinatura.count({
          where: { status: 'PENDENTE' },
        }),
      ]);

      reply.status(200).send({
        totalAprovado: totalAprovado._sum.valorContrato || 0,
        totalPendente: totalPendente._sum.valorContrato || 0,
        pedidosPendentes: countPendente,
      });
    } catch (error) {
      reply.status(500).send({ message: 'Erro ao buscar estatísticas de assinaturas', error });
    }
  }
}