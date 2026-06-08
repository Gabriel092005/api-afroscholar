import { updateSettingsUseCase } from "@/use-cases/update-express-message-use-case";
import { FastifyRequest, FastifyReply } from "fastify";
import z, { ZodError } from "zod";

export async function updateSettingsController(request: FastifyRequest, reply: FastifyReply) {
  try {


 const updateSettingsBodySchema = z.object({
  iban: z.string().min(10, "IBAN muito curto").trim(),
  banco: z.string().min(2, "Nome do banco é obrigatório").trim(),
  mensagem: z.string().min(1, "A mensagem não pode estar vazia").trim(),
});

type UpdateSettingsBody = z.infer<typeof updateSettingsBodySchema>;
    const { iban, banco, mensagem } = updateSettingsBodySchema.parse(request.body);
    await updateSettingsUseCase({ 
      iban, 
      banco, 
      mensagem 
    });

    return reply.status(200).send({ 
      message: "Configurações atualizadas com sucesso!" 
    });

  } catch (error: any) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Falha na validação dos dados",
        details: error.flatten().fieldErrors, 
      });
    }

    // Erros genéricos de servidor
    return reply.status(500).send({ 
      error: "Erro interno", 
      message: error.message 
    });
  }
}