import { erroAoVincularBolsa } from "@/lib/curso-bolsa";
import {
  ErroDocumento,
  apagarFicheiroPrivado,
  erroNoPreco,
  receberDocumento,
  urlPrivada,
} from "@/lib/documentos";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const bodySchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  status: z.enum(["RASCUNHO", "PUBLICADO"]).optional(),
  fileUrl: z.string().optional(),
  bolsaId: z.union([z.string().uuid(), z.literal("")]).optional(),
  preco: z.coerce.number().min(0).optional(),
});

export const createDocumento = async (req: FastifyRequest, res: FastifyReply) => {
  let guardado: string | null = null;
  try {
    const { file, body } = await receberDocumento(req, res);
    if (file) guardado = urlPrivada(file.filename);
    const parsed = bodySchema.parse(body);

    const fileUrl = guardado ?? parsed.fileUrl;
    if (!fileUrl) {
      return res.status(400).send({
        error: "Validation Error",
        message: "Anexe um ficheiro ou informe um URL.",
      });
    }

    const preco = parsed.preco ?? 0;
    const erroPreco = erroNoPreco({ preco, bolsaId: parsed.bolsaId, fileUrl });
    if (erroPreco) return res.status(400).send({ error: "Bad Request", message: erroPreco });

    if (parsed.bolsaId) {
      const erro = await erroAoVincularBolsa(parsed.bolsaId, req.user.sub);
      if (erro) return res.status(erro.status).send({ error: "Bad Request", message: erro.message });
    }

    const documento = await prisma.documento.create({
      data: {
        titulo: parsed.titulo,
        descricao: parsed.descricao,
        categoria: parsed.categoria,
        status: parsed.status || "RASCUNHO",
        fileUrl,
        fileName: file?.originalname,
        fileType: file?.mimetype,
        fileSize: file?.size,
        preco,
        criadoPorId: req.user.sub,
        bolsaId: parsed.bolsaId || null,
      },
    });
    guardado = null;

    return res.status(201).send({
      id: documento.id,
      titulo: documento.titulo,
      message: "Documento criado com sucesso",
    });
  } catch (error) {
    if (error instanceof ErroDocumento) {
      return res.status(400).send({ error: "Bad Request", message: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        issues: error.format(),
      });
    }
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao criar documento.",
    });
  } finally {
    // O documento não ficou criado: o ficheiro já não tem utilidade.
    if (guardado) await apagarFicheiroPrivado(guardado).catch((e) => req.log.error(e));
  }
};
