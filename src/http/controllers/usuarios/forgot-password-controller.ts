import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { sendPasswordResetEmail } from "@/lib/mail";
import { env } from "@/Env";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export async function forgotPassword(req: FastifyRequest, res: FastifyReply) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(200).send({ message: "Se o email existir, receberá um link de recuperação." });
    }

    const token = crypto.randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;

    if (process.env.NODE_ENV !== 'production' && (!env.SMTP_USER || !env.SMTP_PASS)) {
      console.log("⚠️ SMTP not configured, reset link:", resetLink);
    }

    // Sem esperar pelo SMTP: um tempo de resposta maior revelaria que o email existe.
    void sendPasswordResetEmail(email, resetLink);

    return res.send({ message: "Se o email existir, receberá um link de recuperação." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao processar pedido." });
  }
}
