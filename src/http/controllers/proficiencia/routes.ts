import { FastifyInstance } from "fastify";
import { proficienciaConversa } from "./proficiencia-controller";
import { verifyJWT } from "../middleware/verify-jwt";

export async function proficienciaRoutes(fastify: FastifyInstance) {
  fastify.post("/proficiencia", { onRequest: [verifyJWT] }, proficienciaConversa);
}
