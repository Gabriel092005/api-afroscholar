import prisma from "@/lib/prisma"; // default import — não named

export class FetchUserSubscriptionsUseCase {
  async execute(usuarioId: string) {
    return prisma.assinatura.findMany({
      where: {
        empresa: { usuarioId },
      },
      include: {
        bot: {
          select: {
            id:         true,
            nome:       true,
            funcao:     true,
            avatar_url: true,
          },
        },
        empresa:      { select: { nome: true } },
        departamento: { select: { nome: true } },
      },
      orderBy: { dataContratacao: "desc" },
    });
  }
}