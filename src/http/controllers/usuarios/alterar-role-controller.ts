import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AlterarRoleUseCase } from "@/use-cases/alterar-role-usecase";

export async function alterarRoleController(req: FastifyRequest, res: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  });

  const bodySchema = z.object({
    role: z.enum(["ADMIN", "GESTOR", "USUARIO"]),
  });

  try {
    const { id } = paramsSchema.parse(req.params);
    const { role } = bodySchema.parse(req.body);
    const currentUserId = req.user.id;

    const useCase = new AlterarRoleUseCase();
    const { user } = await useCase.execute({
      userId: id,
      novaRole: role,
      currentUserId,
    });

    return res.send(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        message: error.errors.map((e) => e.message).join(", "),
      });
    }
    if (error instanceof Error) {
      return res.status(400).send({ message: error.message });
    }
    return res.status(500).send({ message: "Erro ao alterar role." });
  }
}
