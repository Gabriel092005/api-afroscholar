import prisma from "@/lib/prisma";
import { io } from "@/server"; // Certifique-se de que o caminho do seu servidor socket está correto

interface Request {
  usuarioId:     string;
  iban:          string;
  assinaturaIds: string[];
}

export class ConfirmPaymentUseCase {
  async execute({ usuarioId, iban, assinaturaIds }: Request) {
    if (!assinaturaIds.length) {
      throw new Error("Nenhuma assinatura informada.");
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const assinaturas = await tx.assinatura.findMany({
        where: {
          id:      { in: assinaturaIds },
          empresa: { usuarioId },
          status:  "AGUARDANDO_APROVACAO",
        },
        include: {
          empresa: { select: { nome: true } } // Buscamos o nome para a notificação ser clara
        }
      });

      if (assinaturas.length !== assinaturaIds.length) {
        throw new Error(
          "Uma ou mais assinaturas são inválidas ou já foram processadas."
        );
      }

      await tx.assinatura.updateMany({
        where: { id: { in: assinaturaIds } },
        data: {
          status:          "PENDENTE",
          metodoPagamento: `EXPRESS | IBAN: ${iban}`,
        },
      });


      const admin = await tx.usuario.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true }
      });

      const nomeEmpresa = assinaturas[0]?.empresa?.nome || "Cliente";


      if (admin) {
        await tx.notificacao.create({
          data: {
            usuarioId: admin.id,
            titulo: "Confirmação de Pagamento",
            conteudo: `A empresa ${nomeEmpresa} enviou o IBAN para aprovação de ${assinaturas.length} assinatura(s).`,
            tipo: "AVISO",
            visualizada: false,
          }
        });
      }

      return {
        success:    true,
        quantidade: assinaturas.length,
        empresaNome: nomeEmpresa,
      };
      
      // --- FIM DA ADIÇÃO ---
    });

    // 3. Disparo do Socket.io para o Admin em tempo real
    io.to("admins").emit("nova_notificacao", {
      titulo: "💰 Pagamento para Validar",
      conteudo: `Novo IBAN recebido de ${resultado.empresaNome} (${resultado.quantidade} bots).`,
      tipo: "AVISO",
      created_at: new Date(),
    });

    return {
      success:    true,
      mensagem:   "Pagamento registado. Aguardando aprovação do administrador.",
      quantidade: resultado.quantidade,
    };
  }
}