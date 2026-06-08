import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendNewBolsaToAllUsers } from "@/lib/mail";
import { env } from "@/Env";
import { upload } from "@/lib/upload";

const bodySchema = z.object({
  titulo: z.string().min(1).optional(),
  subtitulo: z.string().optional(),
  categoria: z.string().optional(),
  instituicao: z.string().optional(),
  pais: z.string().optional(),
  nivel: z.string().optional(),
  requisitos: z.string().optional(),
  valor: z.string().optional(),
  moeda: z.string().optional(),
  precoOriginal: z.string().optional(),
  precoInscricao: z.string().optional(),
  precoConsultoria: z.string().optional(),
  precoMentoria: z.string().optional(),
  idioma: z.string().optional(),
  tags: z.string().optional(),
  descricao: z.string().optional(),
  imagemUrl: z.string().optional(),
  linkAplicar: z.string().optional(),
  status: z.string().optional(),
  datasImportantes: z.string().optional(),
  prazo: z.string().optional(),
  numeroVagas: z.string().optional(),
  imagemBg: z.string().optional(),
});

function parseFloatOptional(val: string | undefined): number | undefined {
  if (val === undefined || val === "") return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

function parseIntOptional(val: string | undefined): number | undefined {
  if (val === undefined || val === "") return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

export const updateBolsa = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    await new Promise<void>((resolve, reject) => {
      upload.single("imagemBg")(req.raw as any, res.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const { id } = req.params as { id: string };
    const rawReq = req.raw as any;
    const file = rawReq.file as Express.Multer.File | undefined;
    const body = rawReq.body || req.body || {};
    const parsedBody = bodySchema.parse(body);

    const existingBolsa = await prisma.bolsa.findUnique({
      where: { id },
    });

    if (!existingBolsa) {
      return res.status(404).send({
        error: "Not Found",
        message: "Bolsa não encontrada.",
      });
    }

    const tags = parsedBody.tags
      ? parsedBody.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;
    const datasImportantes = parsedBody.datasImportantes
      ? JSON.parse(parsedBody.datasImportantes)
      : undefined;

    const imagemBg = file ? file.filename : parsedBody.imagemBg;

    const bolsa = await prisma.bolsa.update({
      where: { id },
      data: {
        titulo: parsedBody.titulo,
        subtitulo: parsedBody.subtitulo,
        categoria: parsedBody.categoria,
        instituicao: parsedBody.instituicao,
        pais: parsedBody.pais,
        nivel: parsedBody.nivel,
        requisitos: parsedBody.requisitos,
        valor: parseFloatOptional(parsedBody.valor) ?? 0,
        moeda: parsedBody.moeda,
        precoOriginal: parseFloatOptional(parsedBody.precoOriginal),
        precoInscricao: parseFloatOptional(parsedBody.precoInscricao),
        precoConsultoria: parseFloatOptional(parsedBody.precoConsultoria),
        precoMentoria: parseFloatOptional(parsedBody.precoMentoria),
        idioma: parsedBody.idioma,
        tags,
        descricao: parsedBody.descricao,
        imagemUrl: parsedBody.imagemUrl,
        linkAplicar: parsedBody.linkAplicar,
        status: parsedBody.status as any,
        datasImportantes: datasImportantes as any,
        prazo: parsedBody.prazo ? new Date(parsedBody.prazo) : undefined,
        numeroVagas: parseIntOptional(parsedBody.numeroVagas),
        imagemBg,
      },
    });

    const wasPublished = parsedBody.status === "PUBLICADA" && existingBolsa.status !== "PUBLICADA";
    if (wasPublished) {
      sendNewBolsaToAllUsers(
        bolsa.titulo,
        bolsa.descricao?.substring(0, 200) || "Nova bolsa de estudo disponível na plataforma.",
        `${env.FRONTEND_URL}/bolsas/${bolsa.id}`
      ).catch((err) => console.error("⚠️ Failed to send bolsa notification:", err?.message));
    }

    return res.send({
      id: bolsa.id,
      titulo: bolsa.titulo,
      message: "Bolsa atualizada com sucesso",
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
      message: "Erro ao atualizar bolsa.",
    });
  }
};