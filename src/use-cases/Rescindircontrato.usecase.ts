import { SUBS_STATUS } from "@/generated/enums";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_STATUS } from "@/generated/enums";

interface RescindirContratoInput {
  botEmpresaId: string;
  usuarioId: string;
}

export async function rescindirContratoUseCase(input: RescindirContratoInput) {
  const { botEmpresaId, usuarioId } = input;

  const contrato = await prisma.botEmpresa.findUnique({
    where: { id: botEmpresaId },
    include: {
      empresa: true,
      bot: true,
    },
  });

  if (!contrato) throw new Error("Contrato não encontrado.");
  if (contrato.empresa.usuarioId !== usuarioId) {
    throw new Error("Permissão negada.");
  }
  if (contrato.status === ACCOUNT_STATUS.DESATIVADA) {
    throw new Error("Contrato já se encontra desativado.");
  }

  const agora = new Date();
  const dataLimiteDocumentos = new Date();
  dataLimiteDocumentos.setDate(agora.getDate() + 30); 


  return await prisma.$transaction(async (tx) => {
    
    await tx.botEmpresa.update({
      where: { id: botEmpresaId },
      data: { status: ACCOUNT_STATUS.DESATIVADA },
    });

    await tx.assinatura.updateMany({
      where: {
        botId: contrato.botId,
        empresaId: contrato.empresaId,
        ativa: true,
      },
      data: {
        ativa: false,
        status: SUBS_STATUS.CANCELADO,
        dataExpiracao: agora, 
      },
    });

    await tx.folhaBot.deleteMany({
      where: {
        botEmpresaId: botEmpresaId,
      },
    });
    return {
      mensagem: `O assistente ${contrato.bot.nome} foi removido com sucesso.`,
      documentosAcessiveisAte: dataLimiteDocumentos,
      status: "CONCLUIDO",
    };
  });
}