import { upload } from "@/lib/upload";
import { EnviarMensagemUseCase } from "@/use-cases/enviar-mensagem-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import fs from "node:fs";

export async function handle(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Processar o upload (Promisificado como no seu CreateBot)
    await new Promise<void>((resolve, reject) => {
      upload.array('anexos', 5)(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const files = (rawReq.files as any[]) || [];
    const body = rawReq.body ?? {};

    const { conteudo, botEmpresaId} = body;

    const userId = request.user.sub

    if (!botEmpresaId || !userId) {
      throw new Error("botEmpresaId e usuarioId são obrigatórios.");
    }

    const arquivosUpload = files.map((file: any) => ({
      nome: file.originalname,
      url: file.filename, // Nome salvo na pasta uploads
      tipo: file.mimetype,
    }));

    // 4. Executar persistência
    const useCase = new EnviarMensagemUseCase();
    const mensagemUsuario = await useCase.execute({
      conteudo,
      botEmpresaId,
      usuarioId:userId,
      // remetente: '',
      arquivos: arquivosUpload
    });

    // 5. Resposta de sucesso
    return reply.status(201).send(mensagemUsuario);

  } catch (err) {
    console.error("Erro no Chat Controller:", err);

    // Limpeza de segurança (Unlink) caso algo dê errado após o upload
    const rawReq = request.raw as any;
    const files = (rawReq.files as any[]) || [];
    for (const file of files) {
      if (file.path) {
        fs.unlink(file.path, (error) => {
          if (error) console.error("Erro ao deletar arquivo órfão:", error);
        });
      }
    }

    return reply.status(400).send({
      message: "Erro ao processar mensagem",
      error: err instanceof Error ? err.message : "Erro desconhecido",
    });
  }
}