import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z.string().min(6, "A nova palavra-passe deve ter pelo menos 6 caracteres"),
});

export async function resetPassword(req: FastifyRequest, res: FastifyReply) {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { resetToken: token },
    });

    if (!user) {
      return res.status(400).send({ error: "Invalid Token", message: "Token inválido ou expirado." });
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).send({ error: "Expired Token", message: "Token expirado. Solicite um novo." });
    }

    const hashedPassword = await bcrypt.hash(password, 8);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return res.send({ message: "Palavra-passe redefinida com sucesso." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao redefinir palavra-passe." });
  }
}
