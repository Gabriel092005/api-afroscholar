import crypto from "node:crypto";
import axios from "axios";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { PagamentoMomenu, Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { concederMentoria } from "@/lib/mentoria-acesso";
import { faturacaoPorBolsa, faturacaoPorCurso, faturacaoPorDocumento } from "@/lib/faturacao";
import { MomenuService, type MomenuProduct } from "@/lib/momenu.service";
import { io } from "@/server";

export const VALOR_MINIMO_MOMENU = 100;
export const metodoPagamentoSchema = z.enum(["reference", "momenu-mcx"]);
export const telefoneSchema = z
  .string()
  .regex(/^9\d{8}$/, "O telefone deve ter 9 dígitos e começar por 9");

export type MetodoPagamento = z.infer<typeof metodoPagamentoSchema>;
export type TipoPagamento = PagamentoMomenu["tipo"];

const MCX_EXPIRA_MS = 10 * 60 * 1000;
// A MoMenu pede para não usar o estado como polling; o site consulta a nossa base.
const INTERVALO_VERIFICACAO_EXPRESS_MS = 60 * 1000;
const INTERVALO_VERIFICACAO_REFERENCIA_MS = 30 * 60 * 1000;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** A MoMenu identifica a cobrança pelo nosso id, pelo dela, ou pelos dois. */
export type ChavePagamento = { id?: string; transactionId?: string };

function ondeChave(chave: ChavePagamento) {
  const OR = [
    ...(chave.id ? [{ id: chave.id }] : []),
    ...(chave.transactionId ? [{ transactionId: chave.transactionId }] : []),
  ];
  return { OR };
}

function pertenceACobranca(referencia: string | null, pagamento: PagamentoMomenu): boolean {
  return referencia === pagamento.id || referencia === pagamento.transactionId;
}

export class PagamentoError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

type Notificacao = {
  usuarioId: string;
  titulo: string;
  conteudo: string;
  tipo: "SUCESSO" | "ERRO" | "INFO" | "PAGAMENTO";
  link: string;
};

export async function notificar(n: Notificacao) {
  try {
    await prisma.notification.create({
      data: {
        titulo: n.titulo,
        content: n.conteudo,
        tipo: n.tipo,
        link: n.link,
        entidade: "pagamento",
        userId: n.usuarioId,
      },
    });
    io?.to(n.usuarioId).emit("nova_notificacao", {
      id: crypto.randomUUID(),
      titulo: n.titulo,
      conteudo: n.conteudo,
      tipo: n.tipo,
      link: n.link,
      visualizada: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // O pagamento já ficou registado: uma notificação falhada não o pode reverter.
    console.error("[momenu] falha ao notificar utilizador", error);
  }
}

async function aplicarConfirmacao(
  tx: Prisma.TransactionClient,
  pagamento: PagamentoMomenu,
  invoiceUrl?: string
): Promise<Notificacao | null> {
  if (pagamento.tipo === "CURSO") {
    const alvo = await tx.cursoPagamento.findUnique({
      where: { id: pagamento.alvoId },
      include: { curso: true },
    });
    if (!alvo) return null;
    if (alvo.status === "APROVADO") {
      console.warn(`[momenu] pagamento duplicado para o curso: ${pagamento.id}`);
      return null;
    }

    await tx.cursoPagamento.update({
      where: { id: alvo.id },
      data: {
        status: "APROVADO",
        ...(invoiceUrl ? { comprovativo: invoiceUrl } : {}),
      },
    });

    const matricula = { cursoId: alvo.cursoId, usuarioId: alvo.usuarioId };
    const jaMatriculado = await tx.cursoUsuario.findUnique({
      where: { cursoId_usuarioId: matricula },
    });
    if (!jaMatriculado) {
      await tx.cursoUsuario.create({ data: matricula });
      await tx.curso.update({
        where: { id: alvo.cursoId },
        data: { estudantes: { increment: 1 } },
      });
    }

    return {
      usuarioId: alvo.usuarioId,
      titulo: "Pagamento Aprovado ✅",
      conteudo: `O pagamento do curso "${alvo.curso.titulo}" foi confirmado. Já pode aceder a todo o conteúdo!`,
      tipo: "SUCESSO",
      link: `/cursos/${alvo.cursoId}/aulas`,
    };
  }

  if (pagamento.tipo === "BOLSA") {
    const alvo = await tx.bolsaInscricao.findUnique({
      where: { id: pagamento.alvoId },
      include: { bolsa: true },
    });
    if (!alvo) return null;
    const daCobranca = pertenceACobranca(alvo.referenciaPagamento, pagamento);
    if (alvo.status === "APROVADA" && daCobranca) {
      return null;
    }
    // Os serviços de uma bolsa têm preços diferentes: pagar uma cobrança antiga e
    // mais barata não pode aprovar o serviço que entretanto a substituiu.
    if (!daCobranca) {
      console.error(`[momenu] pagamento recebido numa cobrança substituída (bolsa): ${pagamento.id}`);
      return null;
    }

    await tx.bolsaInscricao.update({
      where: { id: alvo.id },
      data: {
        status: "APROVADA",
        valorPago: pagamento.valor,
        ...(alvo.tipoInteresse === "INSCRICAO" ? { inscritoEm: new Date() } : {}),
        ...(invoiceUrl ? { comprovativoUrl: invoiceUrl } : {}),
      },
    });

    // Só a mentoria abre conteúdos: a inscrição e a consultoria ficam-se pelo serviço pago.
    if (alvo.tipoInteresse === "MENTORIA") {
      await concederMentoria({ usuarioId: alvo.usuarioId, bolsaId: alvo.bolsaId, pago: true }, tx);
      return {
        usuarioId: alvo.usuarioId,
        titulo: "Mentoria Confirmada ✅",
        conteudo: `O pagamento da mentoria de "${alvo.bolsa.titulo}" foi confirmado. Durante 1 mês, tem acesso aos documentos, cursos, comunidades, aulas ao vivo e à inteligência artificial!`,
        tipo: "SUCESSO",
        link: `/bolsas/${alvo.bolsaId}`,
      };
    }

    return {
      usuarioId: alvo.usuarioId,
      titulo: "Inscrição Aprovada ✅",
      conteudo: `O pagamento da inscrição em "${alvo.bolsa.titulo}" foi confirmado!`,
      tipo: "SUCESSO",
      link: `/bolsas/${alvo.bolsaId}`,
    };
  }

  if (pagamento.tipo === "DOCUMENTO") {
    const alvo = await tx.documentoCompra.findUnique({
      where: { id: pagamento.alvoId },
      include: { documento: true },
    });
    if (!alvo) return null;
    if (alvo.status === "APROVADO") {
      console.warn(`[momenu] pagamento duplicado para o documento: ${pagamento.id}`);
      return null;
    }

    await tx.documentoCompra.update({
      where: { id: alvo.id },
      data: {
        status: "APROVADO",
        valor: pagamento.valor,
        ...(invoiceUrl ? { comprovativo: invoiceUrl } : {}),
      },
    });

    return {
      usuarioId: alvo.usuarioId,
      titulo: "Pagamento Aprovado ✅",
      conteudo: `O pagamento do documento "${alvo.documento.titulo}" foi confirmado. Já o pode abrir em Documentos!`,
      tipo: "SUCESSO",
      link: "/documentos",
    };
  }

  const alvo = await tx.mentoriaInscricao.findUnique({
    where: { id: pagamento.alvoId },
    include: { mentoria: true },
  });
  if (!alvo) return null;
  if (alvo.status === "APROVADA") {
    console.warn(`[momenu] pagamento duplicado para a mentoria: ${pagamento.id}`);
    return null;
  }

  await tx.mentoriaInscricao.update({
    where: { id: alvo.id },
    data: {
      status: "APROVADA",
      ...(invoiceUrl ? { comprovativoUrl: invoiceUrl } : {}),
    },
  });

  await concederMentoria(
    { usuarioId: alvo.usuarioId, bolsaId: alvo.mentoria.bolsaId, mentoriaId: alvo.mentoriaId, pago: true },
    tx
  );

  return {
    usuarioId: alvo.usuarioId,
    titulo: "Mentoria Confirmada ✅",
    conteudo: `O pagamento da mentoria "${alvo.mentoria.nome}" foi confirmado. Tem acesso a tudo o que está incluído durante 1 mês!`,
    tipo: "SUCESSO",
    link: "/mentorias",
  };
}

const SERVICOS_PAGOS: Record<string, string> = {
  INSCRICAO: "inscrição paga",
  CONSULTORIA: "consultoria paga",
  MENTORIA: "mentoria paga",
};

const emKwanzas = (valor: number) => `${valor.toLocaleString("pt-PT")} Kz`;

/** Avisa quem criou a bolsa ou o curso do valor recebido e do total acumulado. */
async function notificarDono(pagamento: PagamentoMomenu) {
  try {
    let venda: { donoId: string | null; descricao: string; total: number; tipo: string; link: string } | null = null;

    if (pagamento.tipo === "CURSO") {
      const alvo = await prisma.cursoPagamento.findUnique({
        where: { id: pagamento.alvoId },
        select: { curso: { select: { id: true, titulo: true, criadoPorId: true } } },
      });
      if (alvo) {
        const [faturacao] = await faturacaoPorCurso({ id: alvo.curso.id });
        venda = {
          donoId: alvo.curso.criadoPorId,
          descricao: `"${alvo.curso.titulo}": curso vendido`,
          total: faturacao?.total ?? 0,
          tipo: "Este curso",
          link: "/gestor/cursos",
        };
      }
    } else if (pagamento.tipo === "DOCUMENTO") {
      const alvo = await prisma.documentoCompra.findUnique({
        where: { id: pagamento.alvoId },
        select: { documento: { select: { id: true, titulo: true, criadoPorId: true } } },
      });
      if (alvo) {
        const [faturacao] = await faturacaoPorDocumento({ id: alvo.documento.id });
        venda = {
          donoId: alvo.documento.criadoPorId,
          descricao: `"${alvo.documento.titulo}": documento vendido`,
          total: faturacao?.total ?? 0,
          tipo: "Este documento",
          link: "/gestor/documentos",
        };
      }
    } else {
      const bolsa =
        pagamento.tipo === "BOLSA"
          ? await prisma.bolsaInscricao.findUnique({
              where: { id: pagamento.alvoId },
              select: { tipoInteresse: true, bolsa: { select: { id: true, titulo: true, criadoPorId: true } } },
            })
          : await prisma.mentoriaInscricao
              .findUnique({
                where: { id: pagamento.alvoId },
                select: { mentoria: { select: { bolsa: { select: { id: true, titulo: true, criadoPorId: true } } } } },
              })
              .then((alvo) =>
                alvo?.mentoria.bolsa ? { tipoInteresse: "MENTORIA", bolsa: alvo.mentoria.bolsa } : null
              );

      if (bolsa) {
        const [faturacao] = await faturacaoPorBolsa({ id: bolsa.bolsa.id });
        const servico = bolsa.tipoInteresse ? SERVICOS_PAGOS[bolsa.tipoInteresse] : undefined;
        venda = {
          donoId: bolsa.bolsa.criadoPorId,
          descricao: `"${bolsa.bolsa.titulo}": ${servico ?? "serviço pago"}`,
          total: faturacao?.total ?? 0,
          tipo: "Esta bolsa",
          link: "/gestor/bolsas",
        };
      }
    }

    if (!venda?.donoId) return;

    await notificar({
      usuarioId: venda.donoId,
      titulo: `Pagamento recebido: +${emKwanzas(pagamento.valor)}`,
      conteudo: `${venda.descricao}. ${venda.tipo} já faturou ${emKwanzas(venda.total)}.`,
      tipo: "PAGAMENTO",
      link: venda.link,
    });
  } catch (error) {
    // O pagamento já ficou registado: este aviso não o pode reverter.
    console.error("[momenu] falha ao notificar o dono do item", error);
  }
}

/** Confirma uma cobrança. É seguro repetir: só a primeira chamada tem efeito. */
export async function confirmarPagamento(
  chave: ChavePagamento,
  invoiceUrl?: string
): Promise<boolean> {
  const resultado = await prisma.$transaction(async (tx) => {
    const pagamento = await tx.pagamentoMomenu.findFirst({ where: ondeChave(chave) });
    if (!pagamento) {
      console.error("[momenu] confirmação de uma cobrança desconhecida", chave);
      return { confirmado: false, notificacao: null, pagamento: null };
    }

    const reclamado = await tx.pagamentoMomenu.updateMany({
      where: { id: pagamento.id, status: { not: "PAGO" } },
      data: {
        status: "PAGO",
        pagoEm: new Date(),
        falhaMotivo: null,
        ...(chave.transactionId ? { transactionId: chave.transactionId } : {}),
        ...(invoiceUrl ? { invoiceUrl } : {}),
      },
    });
    if (reclamado.count === 0) return { confirmado: false, notificacao: null, pagamento: null };

    return {
      confirmado: true,
      notificacao: await aplicarConfirmacao(tx, pagamento, invoiceUrl),
      pagamento,
    };
  });

  if (resultado.notificacao) await notificar(resultado.notificacao);
  // Depois da transação, para o total já incluir este pagamento.
  if (resultado.pagamento) await notificarDono(resultado.pagamento);
  return resultado.confirmado;
}

/** Marca como falhada e liberta o utilizador para tentar outra vez. */
export async function falharPagamento(chave: ChavePagamento, motivo?: string): Promise<boolean> {
  const resultado = await prisma.$transaction(async (tx) => {
    const pagamento = await tx.pagamentoMomenu.findFirst({ where: ondeChave(chave) });
    if (!pagamento) return null;

    const reclamado = await tx.pagamentoMomenu.updateMany({
      where: { id: pagamento.id, status: "PENDENTE" },
      data: { status: "FALHADO", falhaMotivo: motivo ?? null },
    });
    if (reclamado.count === 0) return null;

    // A referência tem de coincidir para uma tentativa antiga não cancelar uma mais recente.
    const referencias = [pagamento.id, ...(pagamento.transactionId ? [pagamento.transactionId] : [])];
    let cancelados = 0;
    if (pagamento.tipo === "CURSO") {
      const r = await tx.cursoPagamento.updateMany({
        where: { id: pagamento.alvoId, status: "PENDENTE", referencia: { in: referencias } },
        data: { status: "REJEITADO" },
      });
      cancelados = r.count;
    } else if (pagamento.tipo === "BOLSA") {
      const r = await tx.bolsaInscricao.updateMany({
        where: { id: pagamento.alvoId, status: "PENDENTE", referenciaPagamento: { in: referencias } },
        data: { status: "CANCELADA" },
      });
      cancelados = r.count;
    } else if (pagamento.tipo === "DOCUMENTO") {
      const r = await tx.documentoCompra.updateMany({
        where: { id: pagamento.alvoId, status: "PENDENTE", referencia: { in: referencias } },
        data: { status: "REJEITADO" },
      });
      cancelados = r.count;
    } else {
      const r = await tx.mentoriaInscricao.updateMany({
        where: { id: pagamento.alvoId, status: "PENDENTE", referenciaPagamento: { in: referencias } },
        data: { status: "CANCELADA" },
      });
      cancelados = r.count;
    }

    return cancelados > 0 && pagamento.usuarioId ? pagamento.usuarioId : null;
  });

  if (!resultado) return false;
  await notificar({
    usuarioId: resultado,
    titulo: "Pagamento não concluído",
    conteudo: motivo ?? "O pagamento falhou ou expirou. Pode tentar novamente quando quiser.",
    tipo: "ERRO",
    link: "/minhas-atividades",
  });
  return true;
}

/** Guarda a fatura enviada pelo evento invoice.created. */
export async function registarFatura(chave: ChavePagamento, invoiceUrl: string) {
  const pagamento = await prisma.pagamentoMomenu.findFirst({ where: ondeChave(chave) });
  if (!pagamento) return;

  await prisma.pagamentoMomenu.update({
    where: { id: pagamento.id },
    data: { invoiceUrl },
  });

  const referencias = [pagamento.id, ...(pagamento.transactionId ? [pagamento.transactionId] : [])];
  if (pagamento.tipo === "CURSO") {
    await prisma.cursoPagamento.updateMany({
      where: { id: pagamento.alvoId, referencia: { in: referencias } },
      data: { comprovativo: invoiceUrl },
    });
  } else if (pagamento.tipo === "BOLSA") {
    await prisma.bolsaInscricao.updateMany({
      where: { id: pagamento.alvoId, referenciaPagamento: { in: referencias } },
      data: { comprovativoUrl: invoiceUrl },
    });
  } else if (pagamento.tipo === "DOCUMENTO") {
    await prisma.documentoCompra.updateMany({
      where: { id: pagamento.alvoId, referencia: { in: referencias } },
      data: { comprovativo: invoiceUrl },
    });
  } else {
    await prisma.mentoriaInscricao.updateMany({
      where: { id: pagamento.alvoId, referenciaPagamento: { in: referencias } },
      data: { comprovativoUrl: invoiceUrl },
    });
  }
}

function expirou(pagamento: PagamentoMomenu): boolean {
  const agora = Date.now();
  if (pagamento.metodo === "momenu-mcx") {
    return agora - pagamento.created_at.getTime() > MCX_EXPIRA_MS;
  }
  // A referência continua pagável até ao fim do dia limite.
  return pagamento.dueDate ? agora > pagamento.dueDate.getTime() + UM_DIA_MS : false;
}

const MOTIVO_EXPIRADO =
  "Não recebemos a confirmação a tempo. Se autorizou o pagamento, ele será confirmado automaticamente; verifique o extrato antes de tentar de novo.";

/** Consulta a MoMenu e aplica o estado. Cobre webhooks perdidos. */
export async function sincronizarEstado(
  pagamento: PagamentoMomenu,
  { forcar = false }: { forcar?: boolean } = {}
): Promise<PagamentoMomenu> {
  if (pagamento.status !== "PENDENTE") return pagamento;

  const reler = () => prisma.pagamentoMomenu.findUniqueOrThrow({ where: { id: pagamento.id } });

  // Sem transactionId não há o que consultar: a resposta do Express ainda não chegou.
  if (!pagamento.transactionId) {
    if (expirou(pagamento)) await falharPagamento({ id: pagamento.id }, MOTIVO_EXPIRADO);
    return reler();
  }

  const intervalo =
    pagamento.metodo === "momenu-mcx"
      ? INTERVALO_VERIFICACAO_EXPRESS_MS
      : INTERVALO_VERIFICACAO_REFERENCIA_MS;
  const ultima = pagamento.ultimaVerificacao?.getTime() ?? 0;
  if (!forcar && Date.now() - ultima < intervalo) return pagamento;

  await prisma.pagamentoMomenu.update({
    where: { id: pagamento.id },
    data: { ultimaVerificacao: new Date() },
  });

  try {
    const { status, invoiceUrl, failureReason } = await MomenuService.getPaymentStatus(
      pagamento.transactionId
    );
    if (status === "paid") {
      await confirmarPagamento({ id: pagamento.id }, invoiceUrl);
    } else if (status === "failed") {
      await falharPagamento(
        { id: pagamento.id },
        failureReason ? `O pagamento falhou (código ${failureReason}).` : undefined
      );
    } else if (status === "open" && expirou(pagamento)) {
      await falharPagamento({ id: pagamento.id }, MOTIVO_EXPIRADO);
    }
  } catch (error) {
    console.error(`[momenu] falha ao consultar ${pagamento.id}`, error);
  }

  return reler();
}

export async function sincronizarPendentes(limite = 50): Promise<number> {
  const pendentes = await prisma.pagamentoMomenu.findMany({
    where: { status: "PENDENTE" },
    orderBy: { ultimaVerificacao: { sort: "asc", nulls: "first" } },
    take: limite,
  });
  for (const pagamento of pendentes) {
    await sincronizarEstado(pagamento);
  }
  return pendentes.length;
}

/** Tem cobrança MoMenu: quem decide é o pagamento, não uma aprovação manual. */
export async function temCobrancaMomenu(tipo: PagamentoMomenu["tipo"], alvoId: string): Promise<boolean> {
  return (await prisma.pagamentoMomenu.count({ where: { tipo, alvoId } })) > 0;
}

export function serializarPagamento(pagamento: PagamentoMomenu) {
  return {
    id: pagamento.id,
    transactionId: pagamento.transactionId,
    metodo: pagamento.metodo,
    status: pagamento.status,
    valor: pagamento.valor,
    referenceNumber: pagamento.referenceNumber,
    entity: pagamento.entity,
    dueDate: pagamento.dueDate,
    invoiceUrl: pagamento.invoiceUrl,
    falhaMotivo: pagamento.falhaMotivo,
  };
}

async function executarExpress(
  id: string,
  valor: number,
  phoneNumber: string,
  produtos: MomenuProduct[]
) {
  try {
    const resposta = await MomenuService.createMCX({
      amount: valor,
      phoneNumber,
      products: produtos,
      merchantReferenceId: id,
    });

    if (!resposta?.success || !resposta.transactionId) {
      await falharPagamento({ id }, "A MoMenu recusou o pagamento.");
      return;
    }

    await prisma.pagamentoMomenu.update({
      where: { id },
      data: {
        transactionId: resposta.transactionId,
        ...(resposta.invoiceUrl ? { invoiceUrl: resposta.invoiceUrl } : {}),
      },
    });

    if (resposta.status === "pending") return;
    await confirmarPagamento({ id }, resposta.invoiceUrl);
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status && status >= 400 && status < 500) {
      // A MoMenu recusou o pedido: não há cobrança emitida.
      const data = axios.isAxiosError(error)
        ? (error.response?.data as { error?: unknown; message?: unknown } | undefined)
        : undefined;
      const detalhe = data?.error ?? data?.message;
      await falharPagamento(
        { id },
        typeof detalhe === "string" ? detalhe : "A MoMenu recusou o pagamento."
      ).catch((e) => console.error("[momenu] falha ao registar a recusa", e));
      return;
    }
    // Resultado incerto: o cliente pode ter autorizado. Fica pendente até ao webhook ou à expiração.
    console.error(`[momenu] Express sem resposta conclusiva: ${id}`, axios.isAxiosError(error) ? error.code : error);
  }
}

type IniciarCobranca = {
  tipo: TipoPagamento;
  itemId: string;
  alvoId: string;
  usuarioId: string;
  valor: number;
  metodo?: MetodoPagamento;
  phoneNumber?: string;
  produto: string;
  link: string;
  /** Grava a compra na mesma transação da cobrança. */
  persistirAlvo: (
    tx: Prisma.TransactionClient,
    cobranca: { referencia: string; metodo: MetodoPagamento }
  ) => Promise<unknown>;
};

// Evita duas cobranças quando o mesmo pedido é enviado em duplicado.
const cobrancasEmCurso = new Set<string>();

export async function iniciarCobranca(dados: IniciarCobranca): Promise<PagamentoMomenu> {
  const { tipo, itemId, alvoId, usuarioId, valor, metodo, phoneNumber, produto } = dados;

  if (!metodo) throw new PagamentoError(400, "Selecione o método de pagamento.");
  if (valor < VALOR_MINIMO_MOMENU) {
    throw new PagamentoError(400, `O valor mínimo aceite é de ${VALOR_MINIMO_MOMENU} Kz.`);
  }
  if (metodo === "momenu-mcx" && !phoneNumber) {
    throw new PagamentoError(400, "Indique o número de telefone do Multicaixa Express.");
  }

  const chave = `${tipo}:${itemId}:${usuarioId}`;
  if (cobrancasEmCurso.has(chave)) {
    throw new PagamentoError(409, "Já existe um pagamento a ser processado. Aguarde um momento.");
  }
  cobrancasEmCurso.add(chave);

  try {
    const anterior = await prisma.pagamentoMomenu.findFirst({
      where: { tipo, alvoId, status: "PENDENTE" },
      orderBy: { created_at: "desc" },
    });

    if (anterior) {
      const atual = await sincronizarEstado(anterior, { forcar: true });
      if (atual.status === "PAGO") return atual;
      if (atual.status === "PENDENTE") {
        if (atual.metodo === "momenu-mcx") {
          throw new PagamentoError(
            409,
            "Já tem um pagamento Express à espera de confirmação. Confirme no telemóvel ou aguarde alguns minutos."
          );
        }
        if (metodo === "reference" && atual.valor === valor) return atual;
      }
    }

    const id = crypto.randomUUID();
    const produtos = [
      { id: itemId, productName: produto, productPrice: valor, productQuantity: 1 },
    ];

    if (metodo === "reference") {
      const cobranca = await MomenuService.createReference({
        amount: valor,
        products: produtos,
        merchantReferenceId: id,
      });
      if (!cobranca?.transactionId) {
        throw new PagamentoError(502, "A MoMenu não devolveu o identificador da transação.");
      }

      const pagamento = await prisma.$transaction(async (tx) => {
        await dados.persistirAlvo(tx, { referencia: id, metodo });
        return tx.pagamentoMomenu.create({
          data: {
            id,
            transactionId: cobranca.transactionId,
            operationId: cobranca.operationId,
            tipo,
            alvoId,
            usuarioId,
            valor,
            metodo,
            referenceNumber: cobranca.referenceNumber,
            entity: cobranca.entity,
            dueDate: cobranca.dueDate ? new Date(cobranca.dueDate) : null,
          },
        });
      });

      // Fica disponível nas notificações mesmo depois de fechar o ecrã de pagamento.
      await notificar({
        usuarioId,
        titulo: "Referência de pagamento gerada",
        conteudo: `${produto}: entidade ${cobranca.entity}, referência ${cobranca.referenceNumber}, valor ${valor} Kz.`,
        tipo: "INFO",
        link: dados.link,
      });
      return pagamento;
    }

    // Gravar antes de contactar a MoMenu: se a resposta se perder depois de o cliente
    // autorizar, o webhook ainda encontra a cobrança pelo merchantReferenceId.
    const pagamento = await prisma.$transaction(async (tx) => {
      await dados.persistirAlvo(tx, { referencia: id, metodo });
      return tx.pagamentoMomenu.create({
        data: { id, tipo, alvoId, usuarioId, valor, metodo },
      });
    });

    // O POST só termina quando o cliente reage no telemóvel, por isso não pode prender o pedido.
    void executarExpress(id, valor, phoneNumber!, produtos);

    return pagamento;
  } finally {
    cobrancasEmCurso.delete(chave);
  }
}

/** Responde a erros de pagamento. Devolve null se o erro for de outro tipo. */
export function responderErroPagamento(
  error: unknown,
  req: FastifyRequest,
  res: FastifyReply
) {
  if (error instanceof PagamentoError) {
    return res.status(error.statusCode).send({ error: "Payment Error", message: error.message });
  }
  if (axios.isAxiosError(error)) {
    req.log.error({ status: error.response?.status, code: error.code }, "Erro na MoMenu");
    if (error.code === "ECONNABORTED") {
      return res.status(504).send({
        error: "Gateway Timeout",
        message:
          "A MoMenu não respondeu a tempo. Verifique o seu telemóvel antes de tentar pagar novamente.",
      });
    }
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    const detalhe = data?.message ?? data?.error;
    return res.status(502).send({
      error: "Gateway Error",
      message: typeof detalhe === "string" ? detalhe : "Não foi possível iniciar o pagamento.",
    });
  }
  return null;
}
