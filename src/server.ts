import { Server } from "socket.io";
import fastifyStatic from '@fastify/static';
import { app } from "@/app";
import fastifyOAuth2, { OAuth2Namespace } from '@fastify/oauth2';
import path from 'node:path';
import fs from 'node:fs';
import { env } from "./Env";
import { upload, UPLOAD_PATH } from "./lib/upload";
import { userRoutes } from "./http/controllers/usuarios/routes";
import { googleOAuthRoutes } from "./http/controllers/auth/google-oauth";
import { RegisterLastActiveHook } from "./hooks/update-last-active";
import { NotificationRoutes } from "./http/controllers/notifications/Notification-routes";
import { cursosRoutes } from "./http/controllers/cursos/routes";
import { bolsasRoutes } from "./http/controllers/bolsas/routes";
import { uploadRoutes } from "./http/controllers/upload/routes";
import { comunidadesRoutes } from "./http/controllers/comunidades/routes";
import { depoimentosRoutes } from "./http/controllers/depoimentos/routes";
import { adminRoutes } from "./http/controllers/admin/routes";
import { NovidadesRoutes } from "./http/controllers/novidades/routes";
import { analiseDocumentoRoutes } from "./http/controllers/analise-documento/routes";
import { perfilAcademicoRoutes } from "./http/controllers/perfil-academico/routes";
import { aulasOnlineRoutes } from "./http/controllers/aulas-online/routes";
import { mentoriasRoutes } from "./http/controllers/mentorias/routes";
import { entrevistaRoutes } from "./http/controllers/entrevista/routes";
import { proficienciaRoutes } from "./http/controllers/proficiencia/routes";
import { homeBannersRoutes } from "./http/controllers/home-banners/routes";
import { mapaGlobalRoutes } from "./http/controllers/mapa-global/routes";
import { testEmail } from "./http/controllers/test-email";


declare module "fastify" {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
  }
}


const isProduction = env.NODE_ENV === 'production';

const __dirname = process.cwd();

const uploadDir = path.resolve(__dirname, 'uploads');

// --- 3. REGISTRO DE PLUGINS ---

// IMPORTANTE: Parser para não dar erro 415
app.addContentTypeParser('multipart/form-data', (request, payload, done) => {
  done(null);
});

// No registro do Fastify Static:
app.register(fastifyStatic, {
  root: uploadDir,
  prefix: '/uploads/',
});


// Registro do Static
// app.register(fastifyStatic, {
  //   root: UPLOAD_PATH,
//   prefix: '/uploads/',
//   decorateReply: true
// });

// --- 4. LOGS DE DIAGNÓSTICO (HOOKS) ---

app.addHook('onRequest', (request, reply, done) => {
  if (request.url.startsWith('/uploads/') && process.env.NODE_ENV !== 'production') {
    const filePath = path.join(UPLOAD_PATH, request.url.replace('/uploads/', ''));
    const exists = fs.existsSync(filePath);
    console.log(`🔍 [STATIC] Pedido de imagem: ${request.url}`);
    console.log(`📂 [STATIC] Tentando ler em: ${filePath} | Existe? ${exists ? 'SIM' : 'NÃO'}`);
  }
  done();
});

app.register(RegisterLastActiveHook);

if (env.GOOGLE_CLIENT_ID) {
  app.register(fastifyOAuth2, {
    name: 'googleOAuth2',
    scope: ['openid', 'email', 'profile'],
    credentials: {
      client: {
        id: env.GOOGLE_CLIENT_ID,
        secret: env.GOOGLE_CLIENT_SECRET,
      },
      auth: fastifyOAuth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: env.GOOGLE_CALLBACK_URL,
  });
}
app.register(googleOAuthRoutes);

app.register(userRoutes)
app.register(NotificationRoutes)
app.register(cursosRoutes)
app.register(bolsasRoutes)
app.register(uploadRoutes)
app.register(comunidadesRoutes)
app.register(depoimentosRoutes)
app.register(adminRoutes)
app.register(NovidadesRoutes)
app.register(analiseDocumentoRoutes)
app.register(perfilAcademicoRoutes)
app.register(entrevistaRoutes)
app.register(proficienciaRoutes)
app.register(aulasOnlineRoutes)
app.register(mentoriasRoutes)
app.register(homeBannersRoutes)
app.register(mapaGlobalRoutes)
app.post('/diagnostico/test-email', testEmail)

let io: Server;

const start = async () => {
  try {
    await app.ready();
    io = new Server(app.server, {
      path: "/socket.io/",
      transports: ['polling', 'websocket'],
      cors: {
        origin: [env.FRONTEND_URL],
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 10000,
    });


io.use((socket, next) => {
  const token = socket.handshake.auth?.token
    || socket.handshake.query?.token
    || socket.handshake.headers?.cookie
      ?.split(";")
      .find((c: string) => c.trim().startsWith("token="))
      ?.split("=")?.[1]
      ?.trim();

  if (!token) return next(new Error("Não autorizado"));

  try {
    const payload = app.jwt.verify(token) as { sub: string };
    (socket as any).userId = payload.sub;
    next();
  } catch (err) {
    next(new Error("Token inválido"));
  }
});


io.on("connection", (socket) => {
  const userId = (socket as any).userId;
  if (userId) {
    socket.join(String(userId));
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Usuário ${userId} conectado na sala privada`);
    }
  }

  socket.on("entrar_comunidade", (comunidadeId: string) => {
    socket.join(`comunidade:${comunidadeId}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`👥 Usuário ${userId} entrou na sala comunidade:${comunidadeId}`);
    }
  });

  socket.on("sair_comunidade", (comunidadeId: string) => {
    socket.leave(`comunidade:${comunidadeId}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`👋 Usuário ${userId} saiu da sala comunidade:${comunidadeId}`);
    }
  });

  socket.on("typing", (data: { comunidadeId: string; nome: string }) => {
    socket.to(`comunidade:${data.comunidadeId}`).emit("alguem_escrevendo", {
      comunidadeId: data.comunidadeId,
      usuarioId: userId,
      nome: data.nome,
    });
  });
});

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log("Servidor rodando 🐱‍🏍");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
export { io, app };

start();
