import { FastifyInstance } from "fastify";
import { listAtividades } from "./list-atividades-controller";
import { createAtividade } from "./create-atividade-controller";
import { deleteAtividade } from "./delete-atividade-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function atividadesRoutes(fastify: FastifyInstance) {
  fastify.get("/atividades", listAtividades);
  fastify.post("/atividades", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, createAtividade);
  fastify.delete("/atividades/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, deleteAtividade);
}
