import { FastifyInstance } from "fastify";
import { handle } from "./chat-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { handleListar } from "./listar-mensagens-controller";

export async function ChatRoutes(app: FastifyInstance) {
  app.post('/chat/enviar',{onRequest:[verifyJWT]}, handle);
  app.get('/chat/mensagens', { onRequest: [verifyJWT] }, handleListar);

}