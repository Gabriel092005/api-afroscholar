import { FastifyInstance } from "fastify";
import { createAula } from "./create-aula-controller";
import { listAulas } from "./list-aulas-controller";
import { getAula } from "./get-aula-controller";
import { updateAulaStatus } from "./update-aula-status-controller";
import { participarAula } from "./participar-aula-controller";
import { listParticipantes } from "./list-participantes-controller";
import { deleteAula } from "./delete-aula-controller";
import { verifyJWT } from "../middleware/verify-jwt";

export async function aulasOnlineRoutes(fastify: FastifyInstance) {
  fastify.get("/aulas", { onRequest: [verifyJWT] }, listAulas);
  fastify.post("/aulas", { onRequest: [verifyJWT] }, createAula);
  fastify.get("/aulas/:id", { onRequest: [verifyJWT] }, getAula);
  fastify.patch("/aulas/:id/status", { onRequest: [verifyJWT] }, updateAulaStatus);
  fastify.post("/aulas/:id/participar", { onRequest: [verifyJWT] }, participarAula);
  fastify.get("/aulas/:id/participantes", { onRequest: [verifyJWT] }, listParticipantes);
  fastify.delete("/aulas/:id", { onRequest: [verifyJWT] }, deleteAula);
}
