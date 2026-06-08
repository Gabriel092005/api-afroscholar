import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@/lib/prisma";
import { env } from "@/Env";



export async function googleOAuthRoutes(app: FastifyInstance) {
  app.get("/auth/google/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!env.GOOGLE_CLIENT_ID) {
      return reply.status(501).send({ error: "Google OAuth não configurado." });
    }

    try {
      const result = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
      const token = result.token?.access_token || result.access_token;

      if (!token) {
        return reply.status(500).send({ error: "Falha ao obter token de acesso do Google." });
      }

      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userInfoResponse.ok) {
        const body = await userInfoResponse.text().catch(() => "");
        return reply.status(400).send({ error: "Falha ao buscar dados do usuário Google.", details: body });
      }

      const googleUser = (await userInfoResponse.json()) as {
        id: string;
        email: string;
        name: string;
        picture: string;
      };

      let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            nome: googleUser.name,
            email: googleUser.email,
            password: crypto.randomUUID(),
            image_path: googleUser.picture || null,
            role: "USUARIO",
          },
        });
      }

      const accessToken = await reply.jwtSign(
        { role: user.role },
        { sub: user.id, expiresIn: "7d" }
      );

      const refreshToken = await reply.jwtSign(
        { role: user.role },
        { sub: user.id, expiresIn: "30d" }
      );

      reply.setCookie("refreshToken", refreshToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
      });

      const redirectUrl = `${env.FRONTEND_URL}/auth/google-callback?token=${accessToken}`;
      return reply.redirect(redirectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro no callback do Google OAuth:", msg);
      console.error("GOOGLE_CALLBACK_URL usado:", env.GOOGLE_CALLBACK_URL);
      console.error("FRONTEND_URL usado:", env.FRONTEND_URL);
      return reply.status(500).send({ error: "Erro interno no OAuth.", details: msg });
    }
  });
}
