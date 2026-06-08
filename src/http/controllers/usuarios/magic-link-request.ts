import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendMagicLinkEmail } from "@/lib/mail";
import { env } from "@/Env";

const magicLinkSchema = z.object({
  email: z.string().email(),
});

export async function requestMagicLink(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = magicLinkSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(200).send({ message: "Se o email existir, receberá um link de acesso." });
    }

    const token = await reply.jwtSign(
      { type: "magic-link", email: user.email },
      { sub: String(user.id), expiresIn: "2h" }
    );

    const link = `${env.FRONTEND_URL}/auth/verify-magic-link?token=${encodeURIComponent(token)}`;
    sendMagicLinkEmail(email, link).catch((err) =>
      console.error("⚠️ Failed to send magic link email:", err?.message)
    );

    return reply.status(200).send({ message: "Se o email existir, receberá um link de acesso." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: "Email inválido" });
    }
    console.error(error);
    return reply.status(500).send({ message: "Erro ao solicitar link de acesso" });
  }
}
