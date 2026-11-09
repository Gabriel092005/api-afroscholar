import crypto from "node:crypto";
import { upload } from "@/lib/upload";
import prisma from "@/lib/prisma";
import {
  iniciarCobranca,
  metodoPagamentoSchema,
  responderErroPagamento,
  serializarPagamento,
  telefoneSchema,
} from "@/lib/pagamentos-momenu";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const MAXIMO_DOCUMENTOS = 10;

const bodySchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().optional(),
  areaPretendida: z.string().min(1),
  observacao: z.string().optional(),
  metodoPagamento: metodoPagamentoSchema.optional(),
  phoneNumber: telefoneSchema.optional(),
  tipoId: z
    .union([z.string(), z.array(z.string())])
    .transform((valor) => (Array.isArray(valor) ? valor : [valor])),
});

export async function criarAnaliseDocumentoController(request: FastifyRequest, reply: FastifyReply) {
  const pedidoInvalido = (message: string) => reply.status(400).send({ error: "Bad Request", message });

  try {
    await new Promise<void>((resolve, reject) => {
      upload.fields([
        { name: "arquivo", maxCount: MAXIMO_DOCUMENTOS },
      ])(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = rawReq.files as { [fieldname: string]: Express.Multer.File[] } || {};
    const arquivos = files["arquivo"] ?? [];
    const body = bodySchema.parse(rawReq.body);

    if (arquivos.length !== body.tipoId.length) {
      return pedidoInvalido("Envie um ficheiro para cada documento selecionado.");
    }
    if (new Set(body.tipoId).size !== body.tipoId.length) {
      return pedidoInvalido("Selecione cada documento apenas uma vez.");
    }

    const tipos = await prisma.analiseTipoDocumento.findMany({
      where: { id: { in: body.tipoId }, ativo: true },
    });
    if (tipos.length !== body.tipoId.length) {
      return pedidoInvalido("Um dos documentos selecionados já não está disponível.");
    }

    const usuarioId = request.user.sub;
    const pedidoId = crypto.randomUUID();
    // O preço vem sempre da lista do administrador, nunca do pedido do cliente.
    const itens = body.tipoId.map((id, i) => ({
      tipo: tipos.find((t) => t.id === id)!,
      arquivo: arquivos[i],
    }));
    const total = itens.reduce((soma, item) => soma + item.tipo.preco, 0);

    const documentosDoPedido = (status: string) =>
      itens.map(({ tipo, arquivo }) => ({
        usuarioId,
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        tipoDocumento: tipo.nome,
        areaPretendida: body.areaPretendida,
        observacao: body.observacao,
        arquivoUrl: arquivo.filename,
        valor: tipo.preco,
        status,
      }));

    if (total <= 0) {
      await prisma.analisePedido.create({
        data: {
          id: pedidoId,
          usuarioId,
          valor: 0,
          metodo: "GRATUITO",
          status: "APROVADO",
          documentos: { create: documentosDoPedido("PENDENTE") },
        },
      });
      return reply.status(201).send({ id: pedidoId, message: "Pedido de análise enviado com sucesso" });
    }

    const pagamento = await iniciarCobranca({
      tipo: "ANALISE",
      itemId: "analise-documento",
      alvoId: pedidoId,
      usuarioId,
      valor: total,
      metodo: body.metodoPagamento,
      phoneNumber: body.phoneNumber,
      produto: `Análise de documentos (${itens.length})`,
      link: "/analise-documento",
      persistirAlvo: (tx, cobranca) =>
        tx.analisePedido.create({
          data: {
            id: pedidoId,
            usuarioId,
            valor: total,
            metodo: cobranca.metodo,
            referencia: cobranca.referencia,
            documentos: { create: documentosDoPedido("AGUARDANDO_PAGAMENTO") },
          },
        }),
    });

    return reply.status(201).send({
      id: pedidoId,
      pagamento: serializarPagamento(pagamento),
      message: "Pagamento iniciado. A análise começa assim que for confirmado.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation Error",
        message: err.issues[0]?.message,
        issues: err.format(),
      });
    }
    const resposta = responderErroPagamento(err, request, reply);
    if (resposta) return resposta;

    console.error(err);
    return reply.status(500).send({
      message: "Erro interno ao enviar pedido de análise",
    });
  }
}
