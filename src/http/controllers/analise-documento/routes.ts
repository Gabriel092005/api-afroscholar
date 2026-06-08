import { FastifyInstance } from "fastify";
import { criarAnaliseDocumentoController } from "./criar-analise-documento";
import { listarAnalisesUsuario } from "./listar-analises-usuario";
import { listarAnalisesAdmin } from "./listar-analises-admin";
import { atualizarStatusAnalise } from "./atualizar-status-analise";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function analiseDocumentoRoutes(fastify: FastifyInstance) {
  fastify.post("/analise-documento", { onRequest: [verifyJWT] }, criarAnaliseDocumentoController);
  fastify.get("/analise-documento", { onRequest: [verifyJWT] }, listarAnalisesUsuario);

  fastify.get("/admin/analise-documento", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, listarAnalisesAdmin);
  fastify.patch("/admin/analise-documento/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, atualizarStatusAnalise);
}
