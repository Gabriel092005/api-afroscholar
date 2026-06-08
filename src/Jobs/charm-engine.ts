import cron from 'node-cron';
import prisma from "@/lib/prisma";

export function setupCharmEngine() {
  cron.schedule('0 0 * * *', async () => {
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const usuariosInativos = await prisma.usuario.findMany({
      where: {
        role: 'GESTOR',
        estado_conta: 'ACTIVA',
        last_active_at: { lt: seteDiasAtras }
      }
    });

    for (const usuario of usuariosInativos) {
      await prisma.notificacao.create({
        data: {
          usuarioId: usuario.id,
          content: "Faz tempo que não vemos você! Seus bots sentem sua falta. Que tal conferir os relatórios de hoje?",
        }
      });
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CHARM] Notificação de re-engajamento enviada para: ${usuario.email}`);
      }
    }
  });
}