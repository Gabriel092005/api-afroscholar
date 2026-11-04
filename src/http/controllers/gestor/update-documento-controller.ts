import { erroAoVincularBolsa } from "@/lib/curso-bolsa";
import {
  ErroDocumento,
  apagarFicheiroPrivado,
  erroNoPreco,
  protegerFicheiro,
  receberDocumento,
  urlPrivada,
} from "@/lib/documentos";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const bodySchema = z.object({
  titulo: z.string().min(1).optional(),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  status: z.enum(["RASCUNHO", "PUBLICADO"]).optional(),
  fileUrl: z.string().optional(),
  bolsaId: z.union([z.string().uuid(), z.literal("")]).optional(),
  preco: z.coerce.number().min(0).optional(),
});

export const updateDocumento = async (req: FastifyRequest, res: FastifyReply) => {
  let guardado: string | null = null;
  try {
    const { id } = req.params as { id: string };
    const userId = req.user.sub;

    const [documento, user] = await Promise.all([
      prisma.documento.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);

    if (!documento) {
      return res.status(404).send({ message: "Documento não encontrado." });
    }

    if (user?.role !== "ADMIN" && documento.criadoPorId !== userId) {
      return res.status(403).send({ message: "Não tem permissão para editar este documento." });
    }

    const { file, body } = await receberDocumento(req, res);
    if (file) guardado = urlPrivada(file.filename);
    const parsed = bodySchema.parse(body);

    if (parsed.bolsaId && parsed.bolsaId !== documento.bolsaId) {
      const erro = await erroAoVincularBolsa(parsed.bolsaId, userId);
      if (erro) return res.status(erro.status).send({ error: "Bad Request", message: erro.message });
    }

    const preco = parsed.preco ?? documento.preco;
    const bolsaId = parsed.bolsaId !== undefined ? parsed.bolsaId || null : documento.bolsaId;
    let fileUrl = guardado ?? parsed.fileUrl ?? documento.fileUrl;

    const erroPreco = erroNoPreco({ preco, bolsaId, fileUrl });
    if (erroPreco) return res.status(400).send({ error: "Bad Request", message: erroPreco });

    // Tanto o que está à venda como o que é só da mentoria não pode ficar na pasta pública.
    if (preco > 0 || bolsaId) {
      try {
        fileUrl = await protegerFicheiro(fileUrl);
      } catch (erro) {
        req.log.error(erro);
        return res.status(400).send({
          error: "Bad Request",
          message: "O ficheiro deste documento já não existe no servidor. Carregue-o de novo.",
        });
      }
    }

    const updated = await prisma.documento.update({
      where: { id },
      data: {
        titulo: parsed.titulo,
        descricao: parsed.descricao,
        categoria: parsed.categoria,
        status: parsed.status,
        preco,
        bolsaId,
        fileUrl,
        ...(file
          ? {
              fileName: file.originalname,
              fileType: file.mimetype,
              fileSize: file.size,
            }
          : {}),
      },
    });
    guardado = null;

    // Substituído: o ficheiro anterior deixou de ser usado.
    if (updated.fileUrl !== documento.fileUrl && file) {
      await apagarFicheiroPrivado(documento.fileUrl).catch((e) => req.log.error(e));
    }

    return res.send({
      id: updated.id,
      titulo: updated.titulo,
      message: "Documento atualizado com sucesso",
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
      message: "Erro ao atualizar documento.",
    });
  } finally {
    if (guardado) await apagarFicheiroPrivado(guardado).catch((e) => req.log.error(e));
  }
};
