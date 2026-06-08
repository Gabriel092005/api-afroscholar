import { prisma } from "@/lib/prisma";

export class FetchNovidadesUseCase {
  async execute(params?: { destaque?: boolean; status?: string }) {
    const where: any = {};
    if (params?.destaque !== undefined) where.destaque = params.destaque;
    if (params?.status) where.status = params.status;

    const novidades = await prisma.novidade.findMany({
      where,
      select: {
        id: true,
        title: true,
        introduction: true,
        sobre: true,
        description: true,
        image_path: true,
        image_url: true,
        destaque: true,
        status: true,
        temInscricao: true,
        usuarioId: true,
        created_at: true,
        updated_at: true,
        usuario: {
          select: { nome: true },
        },
        _count: {
          select: { anexos: true }
        }
      },
      orderBy: { created_at: 'desc' },
    });

    return { novidades };
  }
}
