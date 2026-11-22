import type { Cupom, Prisma, TipoPagamentoMomenu } from "@/generated/client";
import prisma from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export class CupomError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const normalizarCodigo = (codigo: string) => codigo.trim().toUpperCase().replace(/\s+/g, "");

export type AplicacaoCupom = {
  cupom: Cupom;
  valorOriginal: number;
  desconto: number;
  valorFinal: number;
};

type Contexto = {
  tipo: TipoPagamentoMomenu;
  itemId: string;
  usuarioId: string;
  valor: number;
};

/** Desconto em Kz inteiros, nunca acima do preço. */
export function calcularDesconto(cupom: Pick<Cupom, "tipoDesconto" | "valor">, valor: number): number {
  const bruto = cupom.tipoDesconto === "PERCENTAGEM" ? (valor * cupom.valor) / 100 : cupom.valor;
  return Math.min(valor, Math.max(0, Math.round(bruto)));
}

/**
 * Valida o cupão para este pagamento e devolve o desconto. Lança CupomError com a razão
 * a mostrar ao cliente. Os usos contam-se só com pagamentos confirmados.
 */
export async function aplicarCupom(codigo: string, ctx: Contexto, db: Db = prisma): Promise<AplicacaoCupom> {
  const cupom = await db.cupom.findUnique({ where: { codigo: normalizarCodigo(codigo) } });
  if (!cupom || !cupom.ativo) throw new CupomError("Cupão inválido.");

  const agora = new Date();
  if (cupom.validoDesde && cupom.validoDesde > agora) throw new CupomError("Este cupão ainda não está ativo.");
  if (cupom.validoAte && cupom.validoAte < agora) throw new CupomError("Este cupão já expirou.");
  if (cupom.tipos.length > 0 && !cupom.tipos.includes(ctx.tipo)) {
    throw new CupomError("Este cupão não é válido para este pagamento.");
  }
  if (cupom.itemId && cupom.itemId !== ctx.itemId) {
    throw new CupomError("Este cupão não é válido para este produto.");
  }
  if (cupom.valorMinimo && ctx.valor < cupom.valorMinimo) {
    throw new CupomError(`Este cupão só vale para compras a partir de ${cupom.valorMinimo.toLocaleString("pt-PT")} Kz.`);
  }
  if (cupom.limiteUsos !== null && cupom.usos >= cupom.limiteUsos) {
    throw new CupomError("Este cupão já atingiu o limite de utilizações.");
  }

  const meusUsos = await db.pagamentoMomenu.count({
    where: { cupomId: cupom.id, usuarioId: ctx.usuarioId, status: "PAGO" },
  });
  if (meusUsos >= cupom.limitePorUsuario) throw new CupomError("Já usou este cupão.");

  const desconto = calcularDesconto(cupom, ctx.valor);
  return { cupom, valorOriginal: ctx.valor, desconto, valorFinal: ctx.valor - desconto };
}

/** Conta o uso quando o pagamento com cupão é confirmado. */
export async function registarUsoCupom(tx: Prisma.TransactionClient, cupomId: string | null) {
  if (!cupomId) return;
  await tx.cupom.update({ where: { id: cupomId }, data: { usos: { increment: 1 } } });
}
