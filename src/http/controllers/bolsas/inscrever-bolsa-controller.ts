import { upload } from "@/lib/upload";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const inscribirSchema = z.object({
  tipoInteresse: z.enum(["CONSULTORIA", "MENTORIA", "INSCRICAO"]).optional(),
  observacoes: z.string().optional(),
  nome: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
  metodoPagamento: z.string().optional(),
  referenciaPagamento: z.string().optional(),
});

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
        { name: "comprovativo", maxCount: 1 },
        { name: "docFile", maxCount: 10 },
      ])(req.raw as any, res.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = req.raw as any;
    const files = rawReq.files as { [fieldname: string]: Express.Multer.File[] } || {};
    const comprovativoFile = files["comprovativo"]?.[0];
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

    const documentosData = docFiles.map((f, i) => ({
      file: f.filename,
      nome: docNomes[i] || `Documento ${i + 1}`,
    }));

    const inscricao = await prisma.bolsaInscricao.upsert({
      where: {
        bolsaId_usuarioId: {
          bolsaId: id,
          usuarioId: userId,
        },
      },
      update: {
        tipoInteresse: body.tipoInteresse,
        observacoes: body.observacoes,
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        metodoPagamento: body.metodoPagamento,
        referenciaPagamento: body.referenciaPagamento,
        comprovativoUrl: comprovativoFile ? comprovativoFile.filename : undefined,
        status: "PENDENTE",
        documentos: {
          deleteMany: {},
          create: documentosData,
        },
      },
      create: {
        bolsaId: id,
        usuarioId: userId,
        tipoInteresse: body.tipoInteresse,
        observacoes: body.observacoes,
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        metodoPagamento: body.metodoPagamento,
        referenciaPagamento: body.referenciaPagamento,
        comprovativoUrl: comprovativoFile ? comprovativoFile.filename : undefined,
        documentos: {
          create: documentosData,
        },
      },
    });

    return res.status(200).send({
      id: inscricao.id,
      message: "Inscrição realizada com sucesso",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        issues: error.format(),
      });
    }
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao fazer inscrição.",
    });
  }
};