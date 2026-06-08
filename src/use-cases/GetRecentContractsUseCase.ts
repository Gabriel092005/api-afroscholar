// src/modules/bots/use-cases/GetMyBotsUseCase.ts
import prisma from "@/lib/prisma";

interface GetMyBotsRequest {
  usuarioId: string;
}

export class GetMyBotsUseCase {
  async execute({ usuarioId }: GetMyBotsRequest) {
    const bots = await prisma.botEmpresa.findMany({
      where: {
        empresa: {
          usuarioId: usuarioId // Filtra bots de todas as empresas do usuário
        }
      },
      orderBy: {
        data_contrato: 'desc',
      },
      include: {
        bot: {
          select: {
            id: true,
            nome: true,
            funcao: true,
            avatar_url: true,
          }
        },
        empresa: {
          select: {
            nome: true,
          }
        },
        departamento: {
          select: {
            nome: true,
          }
        }
      },
    });

    return bots;
  }
}