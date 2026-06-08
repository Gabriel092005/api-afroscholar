import { FastifyInstance } from "fastify";
import { listMapaGlobal } from "./list-mapa-global-controller";
import { createMapaGlobal } from "./create-mapa-global-controller";
import { deleteMapaGlobal } from "./delete-mapa-global-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function mapaGlobalRoutes(fastify: FastifyInstance) {
  fastify.get("/mapa-global", listMapaGlobal);
  fastify.post("/mapa-global", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, createMapaGlobal);
  fastify.delete("/mapa-global/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, deleteMapaGlobal);
}
