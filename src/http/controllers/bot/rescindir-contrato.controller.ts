
import { rescindirContratoUseCase } from "@/use-cases/Rescindircontrato.usecase";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";


const rescindirContratoSchema = z.object({
  botEmpresaId: z.string().uuid("ID do contrato inválido."),
});

export async function rescindirContratoController(
  req: FastifyRequest,
  res: FastifyReply
): Promise<void> {
  // Valida o parâmetro de rota
  const parsed = rescindirContratoSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).send({
      message: "Parâmetros inválidos.",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { botEmpresaId } = parsed.data;

  // Pega o usuário autenticado via middleware (ex: JWT)
  const usuarioId = req.user.sub

  if (!usuarioId) {
    res.status(401).send({ message: "Não autenticado." });
    return;
  }

  try {
    const resultado = await rescindirContratoUseCase({
      botEmpresaId,
      usuarioId,
    });

    res.status(200).send(resultado);
  } catch (error) {
    if (error) {
      res.send({ message: error });
      return;
    }

    console.error("[rescindirContratoController] Erro inesperado:", error);
    res.status(500).send({ message: "Erro interno do servidor." });
  }
}