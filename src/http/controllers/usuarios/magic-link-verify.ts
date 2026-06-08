import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { app } from "@/server";

const verifySchema = z.object({
  token: z.string().min(1),
});

export async function verifyMagicLink(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { token } = verifySchema.parse(request.body);

    let payload: { type: string; email: string; sub: string };
    try {
      payload = app.jwt.verify(token) as any;
    } catch {
      return reply.status(401).send({ message: "Link inválido ou expirado." });
    }

    if (payload.type !== "magic-link") {
      return reply.status(401).send({ message: "Link inválido." });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return reply.status(401).send({ message: "Utilizador não encontrado." });
    }

    const sessionToken = await reply.jwtSign(
      { role: user.role },
      { sub: String(user.id), expiresIn: "2d" }
    );

    const refreshToken = await reply.jwtSign(
      { role: user.role },
      { sub: String(user.id), expiresIn: "7d" }
    );

    return reply
      .setCookie("refreshToken", refreshToken, {
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "none",
      })
      .status(200)
      .send({
        token: sessionToken,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          image_path: user.image_path,
          estado_conta: user.estado_conta,
          phone: user.phone,
          created_at: user.created_at,
          last_active_at: user.last_active_at,
        },
      });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: "Token inválido" });
    }
    console.error(error);
    return reply.status(500).send({ message: "Erro ao verificar link de acesso" });
  }
}
