// src/use-cases/add-to-cart-use-case.ts
import { prisma } from "@/lib/prisma";

interface AddToCartRequest {
  usuarioId: string;
  botId: string;
  empresaId: string;
  departamentoId: string;
}

export class AddToCartUseCase {
  async execute({ usuarioId, botId, empresaId, departamentoId }: AddToCartRequest) {
    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, usuarioId }
    });

    if (!empresa) {
      throw new Error("Empresa não encontrada ou você não tem permissão.");
    }

  const jaNoCarrinho = await prisma.carrinhoItem.findFirst({
  where: { usuarioId, botId, empresaId, departamentoId }
});

if (jaNoCarrinho) {
  throw new Error("Este bot já está no carrinho para este departamento.");
}

    const item = await prisma.carrinhoItem.create({
      data: { usuarioId, botId, empresaId, departamentoId }
    });

    return item;
  }
} 