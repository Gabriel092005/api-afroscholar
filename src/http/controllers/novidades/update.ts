import { upload } from "@/lib/upload";
import { UpdateNovidadeUseCase } from "@/use-cases/update-novidade-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";

export async function updateNovidadeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };

    await new Promise<void>((resolve, reject) => {
      upload.array("files", 10)(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = (rawReq.files as any[]) || [];

    const bodySchema = z.object({
      title: z.string().optional(),
      introduction: z.string().optional(),
      sobre: z.string().optional(),
      description: z.string().optional(),
      destaque: z.enum(["true", "false"]).optional(),
      temInscricao: z.enum(["true", "false"]).optional(),
      status: z.string().optional(),
      image_url: z.string().optional(),
      coverFileIndex: z.string().optional(),
      coverFilePath: z.string().optional(),
    });

    const parsedBody = bodySchema.parse(rawReq.body);

    let imagePath: string | undefined = undefined;

    if (parsedBody.coverFilePath) {
      imagePath = parsedBody.coverFilePath;
    } else if (files.length > 0) {
      const coverIndex = parsedBody.coverFileIndex !== undefined ? parseInt(parsedBody.coverFileIndex, 10) : -1;
      if (coverIndex >= 0 && coverIndex < files.length && files[coverIndex].mimetype.startsWith('image')) {
        imagePath = files[coverIndex].filename;
      } else {
        const mainImage = files.find(f => f.mimetype.startsWith('image'));
        imagePath = mainImage ? mainImage.filename : undefined;
      }
    }

    const updateUseCase = new UpdateNovidadeUseCase();
    const { novidade } = await updateUseCase.execute({
      novidadeId: id,
      ...parsedBody,
      destaque: parsedBody.destaque !== undefined ? parsedBody.destaque === "true" : undefined,
      temInscricao: parsedBody.temInscricao !== undefined ? parsedBody.temInscricao === "true" : undefined,
      image_path: imagePath,
    });

    return reply.status(200).send(novidade);

  } catch (err) {
    console.error(err);
    return reply.status(500).send({
      message: "Erro interno",
      error: err instanceof Error ? err.message : err
    });
  }
}
