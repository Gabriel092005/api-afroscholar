import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@/lib/prisma";
import { env } from "@/Env";
import { sendWelcomeEmail } from "@/lib/mail";

function failRedirect(reply: FastifyReply, reason: string) {
  const url = `${env.FRONTEND_URL}/sign-in?error=google_auth_failed&reason=${encodeURIComponent(reason)}`;
  return reply.redirect(url);
}

export async function googleOAuthRoutes(app: FastifyInstance) {
  // Sem credenciais o plugin não regista esta rota, e o botão levaria a um 404 em JSON.
  if (!env.GOOGLE_CLIENT_ID) {
    app.get("/auth/google", async (_request, reply) => failRedirect(reply, "google_not_configured"));
  }

  app.get("/auth/google/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!env.GOOGLE_CLIENT_ID) {
      console.error("Google OAuth não configurado: GOOGLE_CLIENT_ID em falta.");
      return failRedirect(reply, "google_not_configured");
    }

    try {
      const result = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
      const token = result.token?.access_token;

      if (!token) {
        return failRedirect(reply, "no_access_token");
      }

      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userInfoResponse.ok) {
        const body = await userInfoResponse.text().catch(() => "");
        console.error("Google userinfo falhou:", body);
        return failRedirect(reply, "userinfo_failed");
      }

      const googleUser = (await userInfoResponse.json()) as {
        id: string;
        email: string;
        verified_email?: boolean;
        name: string;
        picture: string;
      };

      // Entramos na conta com o mesmo email: um endereço por confirmar daria acesso à conta de outra pessoa.
      if (!googleUser.verified_email) {
        return failRedirect(reply, "email_nao_verificado");
      }

      const email = googleUser.email.toLowerCase();
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            nome: googleUser.name,
            email,
            password: crypto.randomUUID(),
            image_path: googleUser.picture || null,
            role: "USUARIO",
          },
        });
        void sendWelcomeEmail(email, user.nome);
      }

      if (user.estado_conta === "INACTIVA") {
        return failRedirect(reply, "conta_suspensa");
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
      if (msg.toLowerCase().includes("invalid state")) {
        console.error("query keys:", Object.keys((request as any).query ?? {}));
        console.error("state query:", (request as any).query?.state);
        console.error("cookies presentes:", Object.keys((request as any).cookies ?? {}));
      }
      return failRedirect(reply, msg.slice(0, 160));
    }
  });
}
