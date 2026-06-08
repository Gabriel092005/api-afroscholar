import prisma from "@/lib/prisma";

interface DeleteNovidadeUseCaseRequest {
  novidadeId: string;
}

export class DeleteNovidadeUseCase {
  async execute({ novidadeId }: DeleteNovidadeUseCaseRequest) {
    await prisma.novidade.delete({
      where: { id: novidadeId },
    });

    return { deleted: true };
  }
}
