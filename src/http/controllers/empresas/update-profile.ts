import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { upload } from "@/lib/upload";
import { makeUpdateEmpresaUseCase } from "@/repositories/prisma/make-update-profile";

export async function updateEmpresaController(request: FastifyRequest, reply: FastifyReply) {
  try {
    // 1. Executa o Multer dentro de uma Promise para processar o multipart/form-data
    await new Promise<void>((resolve, reject) => {
      upload.single("logotipo")(request.raw as any, reply.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = request.raw as any;
    const file = rawReq.file;

    // 2. Esquema de validação dos parâmetros da URL
    const updateParamsSchema = z.object({
      id: z.string().uuid("ID da empresa inválido"),
    });

    // 3. Esquema de validação do corpo (campos de texto)
    const updateBodySchema = z.object({
      nome: z.string().optional(),
      descricao: z.string().optional(),
      contacto: z.string().optional(),
      localizacao: z.string().optional(),
      cor_primaria: z.string().optional(),
      website: z.string().optional(),
    });

    // Validar ID e Body
    const { id } = updateParamsSchema.parse(request.params);
    const data = updateBodySchema.parse(rawReq.body);

    const updateUseCase = makeUpdateEmpresaUseCase();

    // 4. Executar o Use Case
    await updateUseCase.execute(id, {
      ...data,
      logotipo: file ? file.filename : undefined,
    });

    return reply.status(200).send({ 
      message: "Perfil da empresa atualizado com sucesso!" 
    });

  } catch (err) {
    // Tratamento de Erros
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ 
        message: "Erro de validação", 
        issues: err.format() 
      });
    }

    // Caso a empresa não exista (Exemplo de erro de negócio)
    if (err instanceof Error && err.message === "Empresa não encontrada") {
      return reply.status(404).send({ message: err.message });
    }

    console.error("Erro ao atualizar empresa:", err);
    return reply.status(500).send({ message: "Erro interno no servidor" });
  }
}