import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { transporter } from "@/lib/mail";
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

    if (!env.SMTP_USER || !env.SMTP_PASS) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("⚠️ SMTP not configured, reset link:", resetLink);
      }
      return res.send({ message: "Se o email existir, receberá um link de recuperação." });
    }

    await transporter.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: email,
      subject: "Recuperação de Palavra-passe — Afroscholars",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #059669; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 24px; }
    .body { padding: 32px 24px; color: #333; }
    .body h2 { margin-top: 0; font-size: 20px; color: #059669; }
    .body p { line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; padding: 14px 32px; background: #059669; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 16px 0; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
    .note { font-size: 12px; color: #999; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Afroscholars</h1>
    </div>
    <div class="body">
      <h2>Recuperação de Palavra-passe</h2>
      <p>Recebemos um pedido de recuperação de palavra-passe para a sua conta.</p>
      <p>Clique no botão abaixo para definir uma nova palavra-passe:</p>
      <a href="${resetLink}" class="btn">Redefinir Palavra-passe</a>
      <p class="note">Este link expira em 1 hora. Se não foi você que pediu, ignore este email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Afroscholars</p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Password reset email sent to ${email}`);
    }
    return res.send({ message: "Se o email existir, receberá um link de recuperação." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao processar pedido." });
  }
}
