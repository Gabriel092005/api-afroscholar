import { prisma } from "@/lib/prisma";

interface ListarArquivosRequest {
  usuarioId: string;
}

export class ListarTodosArquivosUsuarioUseCase {
  async execute({ usuarioId }: ListarArquivosRequest) {

    const arquivos = await prisma.arquivo.findMany({
      where: {
        empresa: {
          usuarioId: usuarioId, 
        },
      },
      include: {
        empresa: {
          select: {
            nome: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return arquivos;
  }
}