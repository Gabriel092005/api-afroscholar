import { prisma } from "@/lib/prisma";

interface DeleteEmpresaRequest {
  id: string;
}

export class DeleteEmpresaUseCase {
  async execute({ id }: DeleteEmpresaRequest) {
    const empresa = await prisma.empresa.findUnique({
      where: { id },
    });

    if (!empresa) {
      throw new Error("Empresa não encontrada.");
    }

    await prisma.empresa.delete({
      where: { id },
    });

    return {};
  }
}