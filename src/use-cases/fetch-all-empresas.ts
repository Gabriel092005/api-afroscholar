import { prisma } from "@/lib/prisma";

export class ListEmpresasWithMetricsUseCase {
  async execute() {
    // 1. Buscar todas as empresas com contagem de seus relacionamentos
    const empresas = await prisma.empresa.findMany({
      include: {
        _count: {
          select: {
            departamentos: true,
            bots_alocados: true,
            transacoes: true
          }
        },
        usuario: { select: { nome: true } } // Nome do gestor responsável
      },
      orderBy: { created_at: 'desc' }
    });

    // 2. Agrupar métricas por Setor (Ramo de Atividade)
    const setoresMetrics = await prisma.empresa.groupBy({
      by: ['sector'],
      _count: { _all: true }
    });

   
    const totalBotsAlocados = await prisma.botEmpresa.count();

    const metrics = {
      total: empresas.length,
      totalBots: totalBotsAlocados,
      setoresDiferentes: setoresMetrics.length,
      topSetor: setoresMetrics.sort((a, b) => b._count._all - a._count._all)[0]?.sector || 'N/A'
    };

    return { empresas, metrics };
  }
}