import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { UpdateProfileUseCase } from "@/use-cases/update-profile";
import { PrismaUserRepository } from "@/repositories/prisma/prisma-user-repository";

export async function updateProfileController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const userId = request.user.sub;

    const updateProfileSchema = z.object({
      nome: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(6).optional(),
      image_path: z.string().optional(),
    });

    const { nome, email, phone, image_path } =
      updateProfileSchema.parse(request.body);

    const usersRepository = new PrismaUserRepository();
    const useCase = new UpdateProfileUseCase(usersRepository);

    const result = await useCase.execute({
      userId,
      nome,
      email,
      phone,
      image_path,
    });

    return reply.status(200).send(result);
  } catch (err: any) {

    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        message: "Erro de validação",
        errors: err.format(),
      });
    }

    if (err.message === "EMAIL_ALREADY_IN_USE") {
      return reply.status(409).send({ message: "Email já em uso" });
    }

    return reply.status(400).send({
      message: "Erro ao atualizar perfil",
    });
  }
}