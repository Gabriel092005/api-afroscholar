// src/jobs/check-subscriptions-job.ts
import prisma from '@/lib/prisma';
import cron from 'node-cron';

export function setupSubscriptionCheck() {
  cron.schedule('0 * * * *', async () => {
    const agora = new Date();

    try {
      const result = await prisma.assinatura.updateMany({
        where: {
          ativa: true,
          dataExpiracao: {
            lt: agora
          },
        },
        data: {
          ativa: false,
          status: 'EXPIRADA'
        },
      });

      if (result.count > 0 && process.env.NODE_ENV !== 'production') {
        console.log(`${result.count} assinaturas foram desativadas por expiração.`);
      }
    } catch (error) {
      console.error('Erro ao verificar assinaturas:', error);
    }
  });
}