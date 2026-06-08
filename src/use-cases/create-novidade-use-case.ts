import prisma from "@/lib/prisma";

interface CreateNovidadeUseCaseRequest {
  title: string;
  introduction: string;
  sobre: string;
  description: string;
  usuarioId: string;
  image_path: string | null;
  image_url?: string | null;
  destaque?: boolean;
  status?: string;
  temInscricao?: boolean;
  anexos: {
    file: string;
    type: string;
  }[];
}

export class CreateNovidadeUseCase {
  async execute({
    title,
    introduction,
    sobre,
    description,
    usuarioId,
    image_path,
    image_url,
    destaque,
    status,
    anexos,
    temInscricao
  }: CreateNovidadeUseCaseRequest) {

    const novidade = await prisma.novidade.create({
      data: {
        title,
        introduction,
        sobre,
        description,
        image_path,
        image_url,
        destaque: destaque ?? false,
        status: status ?? "RASCUNHO",
        temInscricao: temInscricao ?? false,
        usuarioId,
        anexos: {
          create: anexos.map(anexo => ({
            file: anexo.file,
            type: anexo.type
          }))
        }
      },
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