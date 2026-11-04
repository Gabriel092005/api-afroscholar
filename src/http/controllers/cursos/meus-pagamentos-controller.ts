import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

const SERVICOS: Record<string, string> = {
  INSCRICAO: "Inscrição",
  CONSULTORIA: "Consultoria",
  MENTORIA: "Mentoria",
};

/** Histórico de tudo o que o utilizador pagou: cursos, bolsas, mentorias e documentos. */
export const listMeusPagamentos = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const userId = (req.user as any).sub;

    if (!userId) {
      return res.status(401).send({
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
    }

    const [cobrancas, cursos, bolsas, mentorias, documentos] = await Promise.all([
      prisma.pagamentoMomenu.findMany({ where: { usuarioId: userId } }),
      prisma.cursoPagamento.findMany({
        where: { usuarioId: userId },
        include: { curso: { select: { id: true, titulo: true } } },
      }),
      prisma.bolsaInscricao.findMany({
        where: { usuarioId: userId },
        select: {
          id: true,
          bolsaId: true,
          status: true,
          tipoInteresse: true,
          valorPago: true,
          metodoPagamento: true,
          referenciaPagamento: true,
          comprovativoUrl: true,
          created_at: true,
          bolsa: { select: { titulo: true } },
        },
      }),
      prisma.mentoriaInscricao.findMany({
        where: { usuarioId: userId },
        select: { id: true, mentoria: { select: { nome: true } } },
      }),
      prisma.documentoCompra.findMany({
        where: { usuarioId: userId },
        select: { id: true, documento: { select: { titulo: true } } },
      }),
    ]);

    const cursoPorId = new Map(cursos.map((c) => [c.id, c]));
    const bolsaPorId = new Map(bolsas.map((b) => [b.id, b]));
    const mentoriaPorId = new Map(mentorias.map((m) => [m.id, m]));
    const documentoPorId = new Map(documentos.map((d) => [d.id, d]));
    const comCobranca = new Set(cobrancas.map((c) => c.alvoId));

    const pagamentos = [
      ...cobrancas.map((c) => {
        const base = {
          id: c.id,
          tipo: c.tipo,
          valor: c.valor,
          metodo: c.metodo,
          status: c.status as string,
          created_at: c.created_at,
          // Só quem ainda pode pagar precisa dos dados da referência.
          entity: c.status === "PENDENTE" ? c.entity : null,
          referenceNumber: c.status === "PENDENTE" ? c.referenceNumber : null,
          dueDate: c.status === "PENDENTE" ? c.dueDate : null,
          invoiceUrl: c.invoiceUrl,
          falhaMotivo: c.falhaMotivo,
        };

        if (c.tipo === "CURSO") {
          const curso = cursoPorId.get(c.alvoId);
          return {
            ...base,
            titulo: curso?.curso?.titulo ?? "Curso",
            servico: "Curso",
            link: curso ? `/cursos/${curso.cursoId}` : null,
          };
        }

        if (c.tipo === "DOCUMENTO") {
          return {
            ...base,
            titulo: documentoPorId.get(c.alvoId)?.documento.titulo ?? "Documento",
            servico: "Documento",
            link: "/documentos",
          };
        }

        if (c.tipo === "MENTORIA") {
          return {
            ...base,
            titulo: mentoriaPorId.get(c.alvoId)?.mentoria.nome ?? "Mentoria",
            servico: "Mentoria",
            link: "/mentorias",
          };
        }

        const inscricao = bolsaPorId.get(c.alvoId);
        // A inscrição guarda só o último serviço pedido, por isso uma cobrança
        // antiga não pode assumir esse nome.
        const atual =
          inscricao?.referenciaPagamento === c.id || inscricao?.referenciaPagamento === c.transactionId;
        return {
          ...base,
          titulo: inscricao?.bolsa.titulo ?? "Bolsa",
          servico: (atual && inscricao?.tipoInteresse && SERVICOS[inscricao.tipoInteresse]) || "Bolsa",
          link: inscricao ? `/bolsas/${inscricao.bolsaId}` : null,
        };
      }),

      // Pagamentos anteriores à MoMenu, confirmados à mão.
      ...cursos
        .filter((c) => !comCobranca.has(c.id))
        .map((c) => ({
          id: c.id,
          tipo: "CURSO" as const,
          titulo: c.curso?.titulo ?? "Curso",
          servico: "Curso",
          link: `/cursos/${c.cursoId}`,
          valor: c.valor,
          metodo: c.metodo,
          status: c.status as string,
          created_at: c.created_at,
          entity: null,
          referenceNumber: null,
          dueDate: null,
          invoiceUrl: c.comprovativo,
          falhaMotivo: null,
        })),
      ...bolsas
        .filter((b) => !comCobranca.has(b.id) && Number(b.valorPago ?? 0) > 0)
        .map((b) => ({
          id: b.id,
          tipo: "BOLSA" as const,
          titulo: b.bolsa.titulo,
          servico: (b.tipoInteresse && SERVICOS[b.tipoInteresse]) || "Bolsa",
          link: `/bolsas/${b.bolsaId}`,
          valor: Number(b.valorPago),
          metodo: b.metodoPagamento,
          status: b.status as string,
          created_at: b.created_at,
          entity: null,
          referenceNumber: null,
          dueDate: null,
          invoiceUrl: b.comprovativoUrl,
          falhaMotivo: null,
        })),
    ].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return res.send(pagamentos);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar pagamentos.",
    });
  }
};
