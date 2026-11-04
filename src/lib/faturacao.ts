import { startOfMonth } from "date-fns";
import type { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";

export type Faturacao = {
  id: string;
  titulo: string;
  total: number;
  mes: number;
  pagamentos: number;
};

/**
 * Soma o dinheiro recebido por bolsa.
 *
 * Conta as cobranças e não `valorPago`: cada pessoa tem uma só inscrição por bolsa,
 * e comprar outro serviço apaga esse campo, o que faria desaparecer dinheiro já recebido.
 */
export async function faturacaoPorBolsa(where: Prisma.BolsaWhereInput): Promise<Faturacao[]> {
  const bolsas = await prisma.bolsa.findMany({
    where,
    select: {
      id: true,
      titulo: true,
      inscricoes: { select: { id: true, status: true, valorPago: true, updated_at: true } },
      mentorias: { select: { inscricoes: { select: { id: true } } } },
    },
  });

  const inscricaoIds = bolsas.flatMap((b) => b.inscricoes.map((i) => i.id));
  const mentoriaIds = bolsas.flatMap((b) => b.mentorias.flatMap((m) => m.inscricoes.map((i) => i.id)));

  const cobrancas = await prisma.pagamentoMomenu.findMany({
    where: {
      status: "PAGO",
      OR: [
        { tipo: "BOLSA", alvoId: { in: inscricaoIds } },
        { tipo: "MENTORIA", alvoId: { in: mentoriaIds } },
      ],
    },
    select: { alvoId: true, valor: true, pagoEm: true, created_at: true },
  });

  const porAlvo = new Map<string, typeof cobrancas>();
  for (const cobranca of cobrancas) {
    porAlvo.set(cobranca.alvoId, [...(porAlvo.get(cobranca.alvoId) ?? []), cobranca]);
  }

  const inicioDoMes = startOfMonth(new Date());

  return bolsas.map((bolsa) => {
    const resultado: Faturacao = { id: bolsa.id, titulo: bolsa.titulo, total: 0, mes: 0, pagamentos: 0 };
    const somar = (valor: number, data: Date) => {
      resultado.total += valor;
      resultado.pagamentos += 1;
      if (data >= inicioDoMes) resultado.mes += valor;
    };

    const alvos = [
      ...bolsa.inscricoes.map((i) => i.id),
      ...bolsa.mentorias.flatMap((m) => m.inscricoes.map((i) => i.id)),
    ];
    for (const alvo of alvos) {
      for (const c of porAlvo.get(alvo) ?? []) somar(c.valor, c.pagoEm ?? c.created_at);
    }

    // Inscrições anteriores à MoMenu, aprovadas à mão, não têm cobrança.
    for (const inscricao of bolsa.inscricoes) {
      if (
        inscricao.status === "APROVADA" &&
        Number(inscricao.valorPago ?? 0) > 0 &&
        !porAlvo.has(inscricao.id)
      ) {
        somar(Number(inscricao.valorPago), inscricao.updated_at);
      }
    }

    return resultado;
  });
}

export async function faturacaoPorDocumento(where: Prisma.DocumentoWhereInput): Promise<Faturacao[]> {
  const documentos = await prisma.documento.findMany({
    where,
    select: {
      id: true,
      titulo: true,
      compras: {
        where: { status: "APROVADO", valor: { gt: 0 } },
        select: { valor: true, updated_at: true },
      },
    },
  });

  const inicioDoMes = startOfMonth(new Date());

  return documentos.map((documento) => ({
    id: documento.id,
    titulo: documento.titulo,
    total: documento.compras.reduce((acc, c) => acc + c.valor, 0),
    mes: documento.compras
      .filter((c) => c.updated_at >= inicioDoMes)
      .reduce((acc, c) => acc + c.valor, 0),
    pagamentos: documento.compras.length,
  }));
}

export async function faturacaoPorCurso(where: Prisma.CursoWhereInput): Promise<Faturacao[]> {
  const cursos = await prisma.curso.findMany({
    where,
    select: {
      id: true,
      titulo: true,
      pagamentos: {
        where: { status: "APROVADO", valor: { gt: 0 } },
        select: { valor: true, updated_at: true },
      },
    },
  });

  const inicioDoMes = startOfMonth(new Date());

  return cursos.map((curso) => ({
    id: curso.id,
    titulo: curso.titulo,
    total: curso.pagamentos.reduce((acc, p) => acc + Number(p.valor), 0),
    mes: curso.pagamentos
      .filter((p) => p.updated_at >= inicioDoMes)
      .reduce((acc, p) => acc + Number(p.valor), 0),
    pagamentos: curso.pagamentos.length,
  }));
}
