import crypto from "node:crypto";
import { upload } from "@/lib/upload";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/client";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { concederMentoria, temMentoriaNaBolsa } from "@/lib/mentoria-acesso";
import {
  iniciarCobranca,
  metodoPagamentoSchema,
  responderErroPagamento,
  serializarPagamento,
  telefoneSchema,
} from "@/lib/pagamentos-momenu";

// Tem de coincidir com o preço mostrado em ScholarshipDetail.tsx.
const CONSULTORIA_PRECO = 5000;

const inscribirSchema = z.object({
  tipoInteresse: z.enum(["CONSULTORIA", "MENTORIA", "INSCRICAO"]),
  observacoes: z.string().optional(),
  nome: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
  phoneNumber: telefoneSchema.optional(),
  metodoPagamento: metodoPagamentoSchema.optional(),
  dataAgendada: z.string().optional(),
});

function precoDoServico(
  bolsa: { precoInscricao: number | null; precoMentoria: number | null },
  tipo: z.infer<typeof inscribirSchema>["tipoInteresse"]
): number | null {
  if (tipo === "CONSULTORIA") return CONSULTORIA_PRECO;
  return tipo === "MENTORIA" ? bolsa.precoMentoria : bolsa.precoInscricao;
}

function validarAgendamento(dataAgendadaRaw?: string): { data?: Date; erro?: string } {
  if (!dataAgendadaRaw) {
    return { erro: "Selecione a data e hora da consultoria." };
  }

  const data = new Date(dataAgendadaRaw);
  if (isNaN(data.getTime())) {
    return { erro: "Data de agendamento inválida." };
  }

  const diaSemana = data.getDay();
  if (diaSemana === 0 || diaSemana === 6) {
    return { erro: "Selecione um dia útil (segunda a sexta)." };
  }

  const hora = data.getHours();
  if (hora < 9 || hora > 16 || data.getMinutes() !== 0) {
    return { erro: "Selecione um horário em ponto entre 09:00 e 16:00." };
  }

  if (data.getTime() <= Date.now()) {
    return { erro: "Selecione uma data e hora futuras." };
  }

  return { data };
}

export const inscribirBolsa = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req.user as any)?.sub;

    if (!userId) {
      return res.status(401).send({
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
    }

    await new Promise<void>((resolve, reject) => {
      upload.fields([
        { name: "docFile", maxCount: 10 },
      ])(req.raw as any, res.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = req.raw as any;
    const files = rawReq.files as { [fieldname: string]: Express.Multer.File[] } || {};
    const docFiles = files["docFile"] || [];
    const docNomes = rawReq.body.docNome
      ? (Array.isArray(rawReq.body.docNome) ? rawReq.body.docNome : [rawReq.body.docNome])
      : [];

    const body = inscribirSchema.parse(rawReq.body);

    const bolsa = await prisma.bolsa.findUnique({
      where: { id },
    });

    if (!bolsa) {
      return res.status(404).send({
        error: "Not Found",
        message: "Bolsa não encontrada.",
      });
    }

    let dataAgendada: Date | undefined;
    if (body.tipoInteresse === "CONSULTORIA") {
      const agendamento = validarAgendamento(body.dataAgendada);
      if (agendamento.erro) {
        return res.status(400).send({
          error: "Validation Error",
          message: agendamento.erro,
        });
      }

      const conflito = await prisma.bolsaInscricao.findFirst({
        where: {
          bolsaId: id,
          tipoInteresse: "CONSULTORIA",
          status: { in: ["PENDENTE", "APROVADA"] },
          dataAgendada: agendamento.data,
          NOT: { usuarioId: userId },
        },
      });

      if (conflito) {
        return res.status(409).send({
          error: "Conflict",
          message: "Este horário já está reservado. Escolha outro.",
        });
      }

      dataAgendada = agendamento.data;
    }

    const chave = { bolsaId_usuarioId: { bolsaId: id, usuarioId: userId } };
    const existente = await prisma.bolsaInscricao.findUnique({ where: chave });

    // A consultoria pode ser marcada mais de uma vez, e a mentoria renovada quando terminar.
    if (body.tipoInteresse === "INSCRICAO" && existente?.inscritoEm) {
      return res.status(400).send({
        error: "Bad Request",
        message: "Já está inscrito nesta bolsa.",
      });
    }

    // Quem comprou outro serviço depois perdeu o tipo na inscrição, mas não a mentoria.
    if (body.tipoInteresse === "MENTORIA" && (await temMentoriaNaBolsa(userId, id))) {
      return res.status(400).send({
        error: "Bad Request",
        message: "Já tem a mentoria desta bolsa.",
      });
    }

    const valor = precoDoServico(bolsa, body.tipoInteresse);
    if (valor === null) {
      return res.status(400).send({
        error: "Bad Request",
        message: "Este serviço não está disponível nesta bolsa.",
      });
    }

    const documentosData = docFiles.map((f, i) => ({
      file: f.filename,
      nome: docNomes[i] || `Documento ${i + 1}`,
    }));

    const dadosInscricao = {
      tipoInteresse: body.tipoInteresse,
      observacoes: body.observacoes,
      nome: body.nome,
      email: body.email,
      telefone: body.telefone,
      dataAgendada,
      duracaoMinutos: dataAgendada ? 60 : undefined,
    };

    const gravarInscricao = (
      tx: Prisma.TransactionClient,
      alvoId: string | undefined,
      pagamento: {
        status: "PENDENTE" | "APROVADA";
        valorPago: number | null;
        metodoPagamento: string | null;
        referenciaPagamento: string | null;
        comprovativoUrl: string | null;
        inscritoEm?: Date;
      }
    ) =>
      tx.bolsaInscricao.upsert({
        where: chave,
        update: {
          ...dadosInscricao,
          ...pagamento,
          documentos: { deleteMany: {}, create: documentosData },
        },
        create: {
          ...(alvoId ? { id: alvoId } : {}),
          bolsaId: id,
          usuarioId: userId,
          ...dadosInscricao,
          ...pagamento,
          documentos: { create: documentosData },
        },
      });

    if (valor <= 0) {
      const eMentoria = body.tipoInteresse === "MENTORIA";
      const inscricao = await prisma.$transaction(async (tx) => {
        const gravada = await gravarInscricao(tx, undefined, {
          status: "APROVADA",
          valorPago: 0,
          metodoPagamento: "GRATUITO",
          referenciaPagamento: null,
          comprovativoUrl: null,
          ...(body.tipoInteresse === "INSCRICAO" ? { inscritoEm: new Date() } : {}),
        });
        if (eMentoria) await concederMentoria({ usuarioId: userId, bolsaId: id, pago: false }, tx);
        return gravada;
      });

      return res.status(200).send({
        id: inscricao.id,
        status: inscricao.status,
        message: eMentoria ? "Mentoria ativada por 1 mês." : "Inscrição realizada.",
      });
    }

    const alvoId = existente?.id ?? crypto.randomUUID();

    const pagamento = await iniciarCobranca({
      tipo: "BOLSA",
      itemId: id,
      alvoId,
      usuarioId: userId,
      valor,
      metodo: body.metodoPagamento,
      phoneNumber: body.phoneNumber,
      produto: bolsa.titulo || "Bolsa",
      link: `/bolsas/${id}`,
      persistirAlvo: (tx, cobranca) =>
        gravarInscricao(tx, alvoId, {
          status: "PENDENTE",
          valorPago: null,
          metodoPagamento: cobranca.metodo,
          referenciaPagamento: cobranca.referencia,
          comprovativoUrl: null,
        }),
    });

    const pago = pagamento.status === "PAGO";

    return res.status(200).send({
      id: alvoId,
      status: pago ? "APROVADA" : "PENDENTE",
      pagamento: serializarPagamento(pagamento),
      message: pago
        ? "Pagamento confirmado. Acesso aos cursos e aulas ao vivo liberado."
        : "Pagamento iniciado. A inscrição fica aprovada assim que for confirmado.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        message: error.issues[0]?.message,
        issues: error.format(),
      });
    }
    const resposta = responderErroPagamento(error, req, res);
    if (resposta) return resposta;

    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao fazer inscrição.",
    });
  }
};
