import prisma from "@/lib/prisma";


interface GetSubscriptionsRequest {
  usuarioId: string;
}

export class GetSubscriptionsUseCase {


  async execute({ usuarioId }: GetSubscriptionsRequest) {
    // Buscamos as assinaturas filtrando pelo dono da empresa (Segurança)
    const subscriptions = await prisma.assinatura.findMany({
      where: {
        empresa: {
          usuarioId: usuarioId, // Garante que o Gestor só veja as suas
        },
      },
      include: {
        bot: {
          select: {
            nome: true,
          },
        },
        empresa: {
          select: {
            nome: true,
          },
        },
        departamento: {
          select: {
            nome: true,
          },
        },
      },
      orderBy: {
        dataContratacao: 'desc',
      },
    });

    // Mapeamos para garantir que o valorContrato seja um número (Decimal do Prisma -> Number)
    return subscriptions.map((sub) => ({
      ...sub,
      valorContrato: Number(sub.valorContrato),
    }));
  }
}