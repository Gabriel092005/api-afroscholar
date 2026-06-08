import prisma from "@/lib/prisma";

export class GetAssinaturaStatsUseCase {
  async execute() {
    const [totalAprovado, totalPendente, totalRejeitado, countPendente] = await Promise.all([
      prisma.assinatura.aggregate({
        _sum: { valorContrato: true },
        where: { status: 'APROVADO' },
      }),
      prisma.assinatura.aggregate({
        _sum: { valorContrato: true },
        where: { status: 'PENDENTE' },
      }),
      prisma.assinatura.aggregate({
        _sum: { valorContrato: true },
        where: { status: 'CANCELADO' },
      }),
      prisma.assinatura.count({
        where: { status: 'PENDENTE' },
      }),
    ]);

    return {
      totalAprovado:   totalAprovado._sum.valorContrato  ?? 0,
      totalPendente:   totalPendente._sum.valorContrato  ?? 0,
      totalRejeitado:  totalRejeitado._sum.valorContrato ?? 0,
      pedidosPendentes: countPendente,
    };
  }
}