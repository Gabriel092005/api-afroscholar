import { upload } from "@/lib/upload";
import { CreateNovidadeUseCase } from "@/use-cases/create-novidade-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";

export async function createNovidadeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    await new Promise<void>((resolve, reject) => {
      upload.array("files", 10)(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = (rawReq.files as any[]) || [];

    const bodySchema = z.object({
      title: z.string(),
      introduction: z.string(),
      sobre: z.string(),
      description: z.string(),
      destaque: z.enum(["true", "false"]).optional(),
      temInscricao: z.enum(["true", "false"]).optional(),
      status: z.string().optional(),
      image_url: z.string().optional(),
      coverFileIndex: z.string().optional(),
    });

    const parsedBody = bodySchema.parse(rawReq.body);

    let imagePath: string | null = null;
    const coverIndex = parsedBody.coverFileIndex !== undefined ? parseInt(parsedBody.coverFileIndex, 10) : -1;

    if (coverIndex >= 0 && coverIndex < files.length && files[coverIndex].mimetype.startsWith('image')) {
      imagePath = files[coverIndex].filename;
    } else {
      const mainImage = files.find(f => f.mimetype.startsWith('image'));
      imagePath = mainImage ? mainImage.filename : null;
    }

    const anexosData = files.map(f => ({
      file: f.filename,
      type: f.mimetype.split('/')[0]
    }));

    const createUseCase = new CreateNovidadeUseCase();
    const { novidade } = await createUseCase.execute({
      ...parsedBody,
      usuarioId: request.user.sub,
      destaque: parsedBody.destaque === "true",
      temInscricao: parsedBody.temInscricao === "true",
      status: parsedBody.status || "RASCUNHO",
      image_path: imagePath,
      anexos: anexosData
    });

    return reply.status(201).send(novidade);

  } catch (err) {
    console.error(err);
    return reply.status(500).send({
      message: "Erro interno",
      error: err instanceof Error ? err.message : err
    });
  }
}
