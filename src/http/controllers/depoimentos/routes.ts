import { FastifyInstance } from "fastify";
import { listDepoimentos } from "./list-depoimentos";
import { createDepoimento } from "./create-depoimento";
import { deleteDepoimento } from "./delete-depoimento";
import { listDepoimentosAdmin } from "./list-depoimentos-admin";
import { aprovarDepoimento } from "./aprovar-depoimento";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function depoimentosRoutes(fastify: FastifyInstance) {
  fastify.get("/depoimentos", listDepoimentos);

  fastify.post("/depoimentos", { onRequest: [verifyJWT] }, createDepoimento);

  fastify.get("/admin/depoimentos", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, listDepoimentosAdmin);
  fastify.patch("/admin/depoimentos/:id/aprovar", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, aprovarDepoimento);
  fastify.delete("/admin/depoimentos/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, deleteDepoimento);
}
