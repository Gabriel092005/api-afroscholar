import prisma from "@/lib/prisma";



interface RemoveFromCartRequest {
  cartItemId: string;
  usuarioId: string;
}

export class RemoveFromCartUseCase {
  async execute({ cartItemId, usuarioId }:RemoveFromCartRequest) {
    const cartItem = await prisma.carrinhoItem.findFirst({
      where: {
        id: cartItemId,
        usuarioId: usuarioId,
      },
    });

    if (!cartItem) {
      throw new Error("Item não encontrado ou você não tem permissão.");
    }

    await prisma.carrinhoItem.delete({
      where: {
        id: cartItemId,
      },
    });

    return { success: true };
  }
}