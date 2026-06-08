import prisma from "@/lib/prisma";

interface Request {
  usuarioId: string;
}

export class GetPendingSubscriptionsUseCase {
  async execute({ usuarioId }: Request) {
    const assinaturas = await prisma.assinatura.findMany({
      where: {
        empresa: { usuarioId },
        status:  "AGUARDANDO_APROVACAO", // gestor ainda não pagou
      },
      include: {
        bot:          { select: { id: true, nome: true } },
        empresa:      { select: { nome: true } },
        departamento: { select: { nome: true } },
      },
      orderBy: { dataContratacao: "desc" },
    });

    const totalValor = assinaturas.reduce(
      (acc, a) => acc + Number(a.valorContrato), // usa valorContrato, não preco_mensal
      0
    );

    return {
      resumo: {
        quantidade: assinaturas.length,
        totalValor,
        moeda: "Kz",
      },
      assinaturas: assinaturas.map(a => ({
        id:            a.id,
        botId:         a.botId,
        botNome:       a.bot.nome,
        departamento:  a.departamento.nome,
        valorContrato: Number(a.valorContrato),
      })),
    };
  }
}