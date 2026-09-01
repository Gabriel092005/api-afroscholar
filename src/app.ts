import fastify from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { env } from "@/Env";

export const app = fastify({ logger: true, trustProxy: true, bodyLimit: 100 * 1024 * 1024 });

// Hook global de CORS — executa ANTES de qualquer middleware de rota
app.addHook("onRequest", async (request, reply) => {
  const origin = request.headers.origin ?? "*";
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");

  if (request.method === "OPTIONS") {
    return reply.status(204).send();
  }
});

// ✅ Plugins base — SEM await, Fastify gerencia a ordem internamente
app.register(cors, {
  origin: true,
  credentials: true,
});

app.register(cookie);

app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: {
    cookieName: "refreshToken",
    signed: false,
  },
});

