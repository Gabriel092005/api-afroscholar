import prisma from "@/lib/prisma";

interface UpdateNovidadeUseCaseRequest {
  novidadeId: string;
  title?: string;
  introduction?: string;
  sobre?: string;
  description?: string;
  image_path?: string | null;
  image_url?: string | null;
  destaque?: boolean;
  status?: string;
  temInscricao?: boolean;
}

export class UpdateNovidadeUseCase {
  async execute({
    novidadeId,
    ...data
  }: UpdateNovidadeUseCaseRequest) {
    const novidade = await prisma.novidade.update({
      where: { id: novidadeId },
      data,
      include: {
        anexos: true,
        usuario: {
          select: { nome: true }
        }
      }
    });

    return { novidade };
  }
}
