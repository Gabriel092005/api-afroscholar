import { FastifyInstance } from "fastify";
import { proficienciaConversa, gerarQuiz, submeterQuiz } from "./proficiencia-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyMentoriaPaga } from "../middleware/verify-mentoria-paga";

export async function proficienciaRoutes(fastify: FastifyInstance) {
  fastify.post("/proficiencia", { onRequest: [verifyJWT, verifyMentoriaPaga] }, proficienciaConversa);
  fastify.post("/proficiencia/quiz", { onRequest: [verifyJWT, verifyMentoriaPaga] }, gerarQuiz);
  fastify.post("/proficiencia/quiz/submit", { onRequest: [verifyJWT, verifyMentoriaPaga] }, submeterQuiz);
}
