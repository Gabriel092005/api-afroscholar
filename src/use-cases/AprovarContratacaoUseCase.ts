import prisma from "@/lib/prisma";

interface AprovarPagamentoRequest {
  botEmpresaIds: string[];
}

export class AprovarContratacaoUseCase {
  async execute({ botEmpresaIds }: AprovarPagamentoRequest) {
     await prisma.$transaction(async (tx) => {
      
      // 1. Atualiza os contratos para ACTIVA
      await tx.botEmpresa.updateMany({
        where: { id: { in: botEmpresaIds } },
        data: { status: 'ACTIVA' }
      });

      // 2. Busca detalhes para gerar a folha
      const contratosAtivados = await tx.botEmpresa.findMany({
        where: { id: { in: botEmpresaIds } },
        include: { bot: true }
      });

      const agora = new Date();
      const mes = agora.getMonth() + 1;
      const ano = agora.getFullYear();

      const folhas = contratosAtivados.map(be => ({
        botEmpresaId: be.id,
        mes,
        ano,
        custo_api_real: be.bot.custo_api_est ?? 0,
        valor_cobrado: be.bot.preco_mensal ?? 0,
        horas_uso: 0,
      }));

      // 3. Gera a folha de pagamento inicial
      await tx.folhaBot.createMany({ data: folhas });

      return {
        success: true,
        ativados: contratosAtivados.length,
        folhas_geradas: folhas.length
      };
    });
  }
}