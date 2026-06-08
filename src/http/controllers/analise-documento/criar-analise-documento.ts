import { upload } from "@/lib/upload";
import { CreateAnaliseDocumentoUseCase } from "@/use-cases/create-analise-documento-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export async function criarAnaliseDocumentoController(request: FastifyRequest, reply: FastifyReply) {
  try {
    await new Promise<void>((resolve, reject) => {
      upload.fields([
        { name: "arquivo", maxCount: 1 },
      ])(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = rawReq.files as { [fieldname: string]: Express.Multer.File[] } || {};
    const arquivoFile = files["arquivo"]?.[0];

    const bodySchema = z.object({
      nome: z.string().min(1),
      email: z.string().email(),
      telefone: z.string().optional(),
      tipoDocumento: z.string().min(1),
      areaPretendida: z.string().min(1),
      observacao: z.string().optional(),
    });

    const body = bodySchema.parse(rawReq.body);

    const useCase = new CreateAnaliseDocumentoUseCase();
    const { analise } = await useCase.execute({
      usuarioId: request.user.sub,
      nome: body.nome,
      email: body.email,
      telefone: body.telefone,
      tipoDocumento: body.tipoDocumento,
      areaPretendida: body.areaPretendida,
      observacao: body.observacao,
      arquivoUrl: arquivoFile ? arquivoFile.filename : undefined,
    });

    return reply.status(201).send({
      id: analise.id,
      message: "Pedido de análise enviado com sucesso",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        error: "Validation Error",
        issues: err.format(),
      });
    }
    console.error(err);
    return reply.status(500).send({
      message: "Erro interno ao enviar pedido de análise",
    });
  }
}
