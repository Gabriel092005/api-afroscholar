import { FastifyInstance } from "fastify";
import { createMentoria } from "./create-mentoria-controller";
import { listMentorias } from "./list-mentorias-controller";
import { inscreverMentoria } from "./inscrever-mentoria-controller";
import { meuAcessoMentoria } from "./meu-acesso-controller";
import { verifyJWT } from "../middleware/verify-jwt";

export async function mentoriasRoutes(fastify: FastifyInstance) {
  fastify.get("/mentorias", { onRequest: [verifyJWT] }, listMentorias);
  fastify.get("/mentorias/meu-acesso", { onRequest: [verifyJWT] }, meuAcessoMentoria);
  fastify.post("/mentorias", { onRequest: [verifyJWT] }, createMentoria);
  fastify.post("/mentorias/:id/inscrever", { onRequest: [verifyJWT] }, inscreverMentoria);
}
