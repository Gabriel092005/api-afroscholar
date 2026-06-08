import { SUBS_STATUS } from '@/generated/client';
import prisma from "@/lib/prisma";

interface ItemComQuantidade {
  botId:          string;
  empresaId:      string;
  departamentoId: string;
  quantity:       number;
}

export class FinalizarContratacaoUseCase {
  async execute(usuarioId: string, itensComQuantidade: ItemComQuantidade[]) {
    return prisma.$transaction(async (tx) => {
      if (!itensComQuantidade.length) {
        throw new Error("O carrinho está vazio.");
      }

      const botIds   = itensComQuantidade.map(i => i.botId);
      const botsInfo = await tx.bot.findMany({
        where:  { id: { in: botIds } },
        select: { id: true, preco_mensal: true },
      });

      if (botsInfo.length !== new Set(botIds).size) {
        throw new Error("Um ou mais bots não foram encontrados.");
      }

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 30);

      const assinaturasData: {
        botId:           string;
        empresaId:       string;
        departamentoId:  string;
        valorContrato:   number;
        status:          SUBS_STATUS;
        dataExpiracao:   Date;
        metodoPagamento: string;
        ativa:           boolean;
      }[] = [];

      for (const item of itensComQuantidade) {
        const bot   = botsInfo.find(b => b.id === item.botId);
        const preco = Number(bot?.preco_mensal ?? 0);

        for (let i = 0; i < item.quantity; i++) {
          assinaturasData.push({
            botId:           item.botId,
            empresaId:       item.empresaId,
            departamentoId:  item.departamentoId,
            valorContrato:   preco,
            status:          "AGUARDANDO_APROVACAO" as SUBS_STATUS, // aguarda pagamento
            dataExpiracao,
            metodoPagamento: "EXPRESS",
            ativa:           false,
          });
        }
      }

      // Apenas cria as assinaturas — BotEmpresa só é criado após aprovação do admin
      await tx.assinatura.createMany({ data: assinaturasData });
      await tx.carrinhoItem.deleteMany({ where: { usuarioId } });

      return {
        success:    true,
        mensagem:   "Contratação iniciada. Efectue o pagamento para avançar.",
        quantidade: assinaturasData.length,
      };
    });
  }
}