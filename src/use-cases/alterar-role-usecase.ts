import prisma from "@/lib/prisma";

interface AlterarRoleRequest {
  userId: string;
  novaRole: "ADMIN" | "GESTOR" | "USUARIO";
  currentUserId: string;
}

export class AlterarRoleUseCase {
  async execute({ userId, novaRole, currentUserId }: AlterarRoleRequest) {
    if (userId === currentUserId) {
      throw new Error("Não pode alterar a sua própria role.");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("Utilizador não encontrado.");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: novaRole },
    });

    return { user: updated };
  }
}
