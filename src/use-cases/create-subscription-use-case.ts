import prisma from "@/lib/prisma";
import { io } from "@/server";

export interface CheckoutItem {
  botId: string;
  empresaId: string;
  departamentoId: string;
  quantity: number;
}

export class SubscriptionUseCase {
  async checkout(usuarioId: string, itens: CheckoutItem[]) {
    if (itens.length === 0) throw new Error("O carrinho está vazio.");

    const resultado = await prisma.$transaction(async (tx) => {
   
      const botIds = [...new Set(itens.map((i) => i.botId))];
      const bots = await tx.bot.findMany({
        where: { id: { in: botIds } },
        select: { id: true, nome: true, preco_mensal: true },
      });

      const empresa = await tx.empresa.findFirst({
        where: { usuarioId },
        select: { nome: true }
      });

      const precoPorBot = new Map(bots.map((b) => [b.id, Number(b.preco_mensal)]));
      const expiracao = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  
      const assinaturasData = itens.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          botId: item.botId,
          empresaId: item.empresaId,
          departamentoId: item.departamentoId,
          valorContrato: precoPorBot.get(item.botId) ?? 0,
          dataExpiracao: expiracao,
          status: "PENDENTE" as const,
          metodoPagamento: "EXPRESS",
          ativa: false,
        }))
      );

      await tx.assinatura.createMany({ data: assinaturasData });

      // 3. Busca o Administrador único
      const admin = await tx.usuario.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true }
      });

      // Se existir um admin, salva a notificação no banco para ele
      if (admin) {
        await tx.notificacao.create({
          data: {
            usuarioId: admin.id,
            titulo: "Novo Pedido de Assinatura",
            conteudo: `A empresa ${empresa?.nome || 'Desconhecida'} solicitou ${assinaturasData.length} novos bots.`,
            tipo: "AVISO",
            visualizada: false,
          }
        });
      }

      // 4. Limpa o carrinho do usuário
      await tx.carrinhoItem.deleteMany({ where: { usuarioId } });

      return {
        totalItens: assinaturasData.length,
        empresaNome: empresa?.nome || 'Nova Empresa',
      };
    });

    // 5. DISPARO DO SOCKET
    // Mesmo sendo apenas um admin, manter a sala "admins" é uma boa prática
    io.to("admins").emit("nova_notificacao", {
      titulo: "🚨 Novo Pedido Pendente",
      conteudo: `Recebemos um pedido de ${resultado.totalItens} bots de: ${resultado.empresaNome}.`,
      tipo: "AVISO",
      created_at: new Date(),
    });

    return {
      sucesso: true,
      mensagem: "Pedido enviado. Aguarde a validação do administrador.",
    };
  }
}