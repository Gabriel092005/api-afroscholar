// create-bot-controller.ts
import { upload } from "@/lib/upload";
import { CreateBotUseCase } from "@/use-cases/create-bot-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import { createBotSchema } from "./create-bot-type";
import fs from "node:fs";

export async function createBotController(request: FastifyRequest, reply: FastifyReply) {
  try {

    await new Promise<void>((resolve, reject) => {
      upload.any()(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = (rawReq.files as any[]) || [];
    const body = rawReq.body ?? {};

    // 2. Mapear os vídeos pelos fieldnames (ex: video_apresentacao → APRESENTACAO)
    const videos = files.map((file: any) => ({
      estado: file.fieldname.replace("video_", "").toUpperCase(),
      video_path: file.filename,
    }));

    // 3. Validar payload com Zod
    const payloadValidado = createBotSchema.parse({
      ...body,
      videos,
    });

    // 4. Chamar Use Case
    const createBotUseCase = new CreateBotUseCase();
    const bot = await createBotUseCase.execute(payloadValidado);

    return reply.status(201).send(bot);

  } catch (err) {
    console.error(err);

    // Remove arquivos enviados em caso de erro
    const rawReq = request.raw as any;
    const files = (rawReq.files as any[]) || [];
    for (const file of files) {
      fs.unlink(file.path, () => {});
    }

    return reply.status(500).send({
      message: "Erro interno",
      error: err instanceof Error ? err.message : err,
    });
  }
}