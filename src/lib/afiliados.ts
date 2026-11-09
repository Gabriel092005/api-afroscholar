import type { FastifyRequest } from "fastify";
import type { PagamentoMomenu, Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";

export const SLUG_PERCENTUAL_GLOBAL = "afiliados_comissao_percentual";
const PERCENTUAL_PADRAO = 10;

type Cliente = Prisma.TransactionClient;
export type TipoAfiliado = "BOLSA" | "DOCUMENTO" | "CURSO";

const arredondar = (valor: number) => Math.round(valor * 100) / 100;

export async function percentualGlobal(cliente: Cliente = prisma): Promise<number> {
  const setting = await cliente.setting.findUnique({ where: { slug: SLUG_PERCENTUAL_GLOBAL } });
  const valor = Number(setting?.value);
  return setting?.value != null && Number.isFinite(valor) ? valor : PERCENTUAL_PADRAO;
}

/** O código que o frontend guardou quando o comprador abriu o link. */
export function codigoAfiliadoDoPedido(req: FastifyRequest): string | undefined {
  const codigo = req.headers["x-afiliado-ref"];
  return typeof codigo === "string" && /^[A-Z0-9]{6,20}$/.test(codigo) ? codigo : undefined;
}

/** Devolve o link só se for deste produto e não for do próprio comprador. */
export async function resolverLinkAfiliado(
  codigo: string | undefined,
  tipo: PagamentoMomenu["tipo"],
  itemId: string,
  compradorId: string
): Promise<string | null> {
  if (!codigo) return null;
  const link = await prisma.afiliadoLink.findUnique({ where: { codigo } });
  if (!link || link.tipo !== tipo || link.itemId !== itemId || link.usuarioId === compradorId) return null;
  return link.id;
}

/** Corre dentro da transação que confirma o pagamento. */
export async function registarComissao(tx: Cliente, pagamento: PagamentoMomenu) {
  if (!pagamento.afiliadoLinkId) return null;
  const link = await tx.afiliadoLink.findUnique({ where: { id: pagamento.afiliadoLinkId } });
  if (!link) return null;

  const consulta = { where: { id: link.itemId }, select: { comissaoAfiliado: true, titulo: true } };
  const produto =
    link.tipo === "BOLSA"
      ? await tx.bolsa.findUnique(consulta)
      : link.tipo === "CURSO"
        ? await tx.curso.findUnique(consulta)
        : await tx.documento.findUnique(consulta);

  const percentual = produto?.comissaoAfiliado ?? (await percentualGlobal(tx));
  const valor = arredondar((pagamento.valor * percentual) / 100);
  if (valor <= 0) return null;

  await tx.afiliadoComissao.create({
    data: {
      pagamentoId: pagamento.id,
      afiliadoId: link.usuarioId,
      linkId: link.id,
      valorVenda: pagamento.valor,
      percentual,
      valor,
    },
  });

  return {
    usuarioId: link.usuarioId,
    titulo: `Comissão recebida: +${valor.toLocaleString("pt-PT")} Kz`,
    conteudo: `Uma venda de "${produto?.titulo ?? "produto"}" foi paga através do seu link.`,
    tipo: "PAGAMENTO" as const,
    link: "/afiliados",
  };
}

/** Saques pendentes já reservam saldo; os rejeitados devolvem-no. */
export async function calcularSaldo(usuarioId: string, cliente: Cliente = prisma) {
  const [ganhos, saques] = await Promise.all([
    cliente.afiliadoComissao.aggregate({ where: { afiliadoId: usuarioId }, _sum: { valor: true } }),
    cliente.afiliadoSaque.groupBy({
      by: ["status"],
      where: { usuarioId, status: { in: ["PENDENTE", "PAGO"] } },
      _sum: { valor: true },
    }),
  ]);

  const soma = (status: "PENDENTE" | "PAGO") => saques.find((s) => s.status === status)?._sum.valor ?? 0;
  const totalGanho = ganhos._sum.valor ?? 0;
  const emSaque = soma("PENDENTE");
  const sacado = soma("PAGO");

  return { totalGanho, emSaque, sacado, disponivel: arredondar(totalGanho - emSaque - sacado) };
}
