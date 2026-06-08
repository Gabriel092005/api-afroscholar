import { prisma } from "@/lib/prisma";

interface Request {
  botEmpresaId: string;
}

export class GetBotEmpresaDetailsUseCase {
  async execute({ botEmpresaId }: Request) {
    const botEmpresa = await prisma.botEmpresa.findUnique({
      where: { id: botEmpresaId },
      include: {
        bot: {
          include: {
            assets: true,
            whatBotCanDos: true,
            whatBotCanNotDos: true,
          },
        },
        empresa: {
          select: { nome: true, logotipo: true, sector: true },
        },
        departamento: {
          select: { nome: true },
        },
      },
    });

    if (!botEmpresa) {
      throw new Error("Bot contratado não encontrado.");
    }

    return botEmpresa;
  }
}