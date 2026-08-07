import { FastifyInstance } from "fastify";
import { proficienciaConversa, gerarQuiz, submeterQuiz } from "./proficiencia-controller";
import { verifyJWT } from "../middleware/verify-jwt";

export async function proficienciaRoutes(fastify: FastifyInstance) {
  fastify.post("/proficiencia", { onRequest: [verifyJWT] }, proficienciaConversa);
  fastify.post("/proficiencia/quiz", { onRequest: [verifyJWT] }, gerarQuiz);
  fastify.post("/proficiencia/quiz/submit", { onRequest: [verifyJWT] }, submeterQuiz);
}
