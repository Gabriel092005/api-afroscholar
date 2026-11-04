import prisma from "@/lib/prisma";

interface SuspendUsuarioRequest {
  id: string;
}

export class SuspendUsuarioUseCase {
  async execute({ id }: SuspendUsuarioRequest) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("Utilizador não encontrado.");
    }

    const novoEstado = user.estado_conta === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA';

    const updated = await prisma.user.update({
      where: { id },
      data: {
        estado_conta: novoEstado,
      },
      // A resposta vai para o browser: nunca pode incluir a palavra-passe.
      select: { id: true, nome: true, email: true, role: true, estado_conta: true },
    });

    return { user: updated };
  }
}
