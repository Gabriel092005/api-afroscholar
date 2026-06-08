import prisma from "@/lib/prisma";
import { io } from "@/server";

export class AdminSubscriptionUseCase {

  async listAll() {
    return prisma.assinatura.findMany({
      include: {
        bot: { select: { id: true, nome: true, preco_mensal: true } },
        empresa: { select: { id: true, nome: true, usuarioId: true } }, // Adicionado usuarioId para facilitar
        departamento: { select: { id: true, nome: true } },
      },
      orderBy: { dataContratacao: "desc" },
    });
  }

  async approve(id: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Busca os dados necessários, incluindo o bot e o dono da empresa
      const assinatura = await tx.assinatura.findUnique({ 
        where: { id },
        include: { 
          bot: true, 
          empresa: { select: { usuarioId: true } } 
        } 
      });

      if (!assinatura) {
        throw new Error("Assinatura não encontrada.");
      }

      if (assinatura.status !== "PENDENTE") {
        throw new Error(
          `Apenas assinaturas PENDENTE podem ser aprovadas. Estado actual: "${assinatura.status}".`
        );
      }

      // 2. Atualiza a assinatura
      const updatedAssinatura = await tx.assinatura.update({
        where: { id },
        data: {
          status: "APROVADO",
          ativa: true,
          dataExpiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // 3. Cria a alocação real do bot no departamento (BotEmpresa)
      const botEmpresa = await tx.botEmpresa.create({
        data: {
          botId: assinatura.botId,
          empresaId: assinatura.empresaId,
          departamentoId: assinatura.departamentoId,
          status: "ACTIVA",
          data_contrato: new Date(),
        },
      });

      // 4. Gera folha do mês corrente
      const agora = new Date();
      await tx.folhaBot.create({
        data: {
          botEmpresaId: botEmpresa.id,
          mes: agora.getMonth() + 1,
          ano: agora.getFullYear(),
          valor_cobrado: assinatura.valorContrato,
          custo_api_real: 0,
          horas_uso: 0,
        },
      });

      // 5. Cria a Notificação persistente para o Gestor
      const notificacao = await tx.notificacao.create({
        data: {
          titulo: "Bot Ativado com Sucesso! 🤖",
          conteudo: `O pagamento foi aprovado e o bot "${assinatura.bot.nome}" já está disponível no seu departamento.`,
          tipo: "PAGAMENTO",
          usuarioId: assinatura.empresa.usuarioId,
          entidade: "bot",
          entidadeId: assinatura.botId,
          link: `/pagamento/historico`,
        },
      });

      // 6. Emite o sinal via Socket.IO para o frontend
      io.to(assinatura.empresa.usuarioId).emit("nova_notificacao", {
        id: notificacao.id,
        titulo: notificacao.titulo,
        conteudo: notificacao.conteudo,
        tipo: notificacao.tipo,
        link: notificacao.link,
        visualizada: false,
        created_at: notificacao.created_at,
      });

      return {
        assinatura: updatedAssinatura,
        botEmpresaId: botEmpresa.id,
      };
    });
  }

  async reject(id: string) {
    const assinatura = await prisma.assinatura.findUnique({ 
      where: { id },
      include: { bot: { select: { nome: true } }, empresa: { select: { usuarioId: true } } }
    });

    if (!assinatura) {
      throw new Error("Assinatura não encontrada.");
    }

    if (!["AGUARDANDO_APROVACAO", "PENDENTE"].includes(assinatura.status)) {
      throw new Error(
        `Não é possível rejeitar uma assinatura com estado "${assinatura.status}".`
      );
    }

    const updated = await prisma.assinatura.update({
      where: { id },
      data: { status: "REJEITADO", ativa: false },
    });


    const notificacao = await prisma.notificacao.create({
      data: {
        titulo: "Pagamento Rejeitado ❌",
        conteudo: `Infelizmente a sua solicitação para o bot "${assinatura.bot.nome}" não foi aprovada. Verifique os dados de pagamento.`,
        tipo: "ERRO",
        usuarioId: assinatura.empresa.usuarioId,
        link:'/pagamento/historico'
      }
    });

    io.to(assinatura.empresa.usuarioId).emit("nova_notificacao", notificacao);

    return updated;
  }
}