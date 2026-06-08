import prisma from "@/lib/prisma";

export async function getHealthOverview() {
  const [total, ativos] = await Promise.all([
    prisma.user.count({ where: { role: 'GESTOR' } }),
    prisma.user.count({ 
      where: { 
        role: 'GESTOR',
        last_active_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      } 
    })
  ]);

  const taxaExistencia = total > 0 ? (ativos / total) * 100 : 0;

  return {
    totalGestores: total,
    ativosNaSemana: ativos,
    taxaExistencia: `${taxaExistencia.toFixed(1)}%`,
    status: taxaExistencia > 75 ? "EXCELENTE" : "ALERTA"
  };
}
