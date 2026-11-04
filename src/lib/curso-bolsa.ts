import { VALOR_MINIMO_MOMENU } from "@/lib/pagamentos-momenu";
import prisma from "@/lib/prisma";

/**
 * Um gestor só pode vincular um curso ou uma comunidade às suas bolsas, porque a
 * inscrição aprovada numa bolsa dá acesso aos cursos vinculados. Devolve o erro, se houver.
 */
export async function erroAoVincularBolsa(
  bolsaId: string,
  userId: string
): Promise<{ status: number; message: string } | null> {
  const [bolsa, user] = await Promise.all([
    prisma.bolsa.findUnique({ where: { id: bolsaId }, select: { criadoPorId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);

  if (!bolsa) return { status: 404, message: "A bolsa selecionada não existe." };
  if (user?.role !== "ADMIN" && bolsa.criadoPorId !== userId) {
    return { status: 403, message: "Só pode fazer a ligação a uma bolsa criada por si." };
  }
  return null;
}

/** Um curso sem bolsa é vendido à parte: precisa de um valor, ou de 0 se for gratuito. */
export function erroNoPrecoDoCurso(preco: number | null | undefined): string | null {
  if (preco === null || preco === undefined || Number.isNaN(preco)) {
    return "Indique o valor do curso.";
  }
  if (preco < 0 || (preco > 0 && preco < VALOR_MINIMO_MOMENU)) {
    return `O valor deve ser 0 (gratuito) ou pelo menos ${VALOR_MINIMO_MOMENU} Kz.`;
  }
  return null;
}
