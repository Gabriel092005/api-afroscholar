import { prisma } from "@/lib/prisma";

interface GetNovidadeDetailsRequest {
  novidadeId: string;
}

export class GetNovidadeDetailsUseCase {
  async execute({ novidadeId }: GetNovidadeDetailsRequest) {
    const novidade = await prisma.novidade.findUniqueOrThrow({
      where: { id: novidadeId },
      include: {
        usuario: {
          select: { nome: true },
        },
        anexos: true,
      },
    });

    return { novidade };
  }
}
