// src/use-cases/fetch-cart-items-use-case.ts
import { prisma } from "@/lib/prisma";

export class FetchCartItemsUseCase {
  async execute(usuarioId: string) {
    const itens = await prisma.carrinhoItem.findMany({
      where: { usuarioId },
      include: {
        bot: {
          include: { assets: true }
        },
        empresa: true,
        departamento: true
      }
    });

    return itens;
  }
}