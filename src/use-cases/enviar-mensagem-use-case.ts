import { prisma } from "@/lib/prisma";
import { ACCOUNT_STATUS } from "@/generated/enums";


interface Request {
  conteudo?: string;
  usuarioId: string;
  botEmpresaId: string;
  arquivos?: { nome: string; url: string; tipo: string; tamanho?: number }[];
}

export class EnviarMensagemUseCase {
  async execute({ conteudo, usuarioId, botEmpresaId, arquivos }: Request) {
    
    // 1. Busca o vínculo do bot com a empresa para validar status e obter o empresaId
    const botEmpresa = await prisma.botEmpresa.findUnique({
      where: { id: botEmpresaId },
      select: { 
        id: true, 
        status: true,
        empresaId: true // Precisamos disso para a tabela Arquivo
      },
    });

    if (!botEmpresa) {
      throw new Error("Bot não vinculado a esta empresa.");
    }

    if (botEmpresa.status === ACCOUNT_STATUS.DESATIVADA) {
      throw new Error("Este contrato está desativado. Não é possível enviar mensagens.");
    }

    const resultado = await prisma.$transaction(async (tx) => {
      
      const mensagem = await tx.mensagem.create({
        data: {
          conteudo,
          remetente: "USUARIO",
          usuarioId,
          botEmpresaId,
          anexos: {
            create: arquivos?.map(a => ({
              nome: a.nome,
              url: a.url,
              tipo: a.tipo,
              tamanho: a.tamanho,
            })),
          },
        },
        include: {
          anexos: true,
          usuario: { 
            select: { id: true, nome: true, email: true, image_path: true, role: true } 
          },
        },
      });

    
      if (arquivos && arquivos.length > 0) {
        await tx.arquivo.createMany({
          data: arquivos.map(a => ({
            nome: a.nome,
            url: a.url,
            tipo: a.tipo,
            empresaId: botEmpresa.empresaId
          })),
        });
      }

      return mensagem;
    });

    return resultado;
  }
}