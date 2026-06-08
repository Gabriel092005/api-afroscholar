import { FastifyInstance } from "fastify";
import { entrevistaBolsa } from "./entrevista-controller";
import { verifyJWT } from "../middleware/verify-jwt";

export async function entrevistaRoutes(fastify: FastifyInstance) {
  fastify.post("/entrevista", { onRequest: [verifyJWT] }, entrevistaBolsa);
}
