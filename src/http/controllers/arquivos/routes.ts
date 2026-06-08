import { FastifyInstance } from "fastify";
import { verifyJWT } from "../middleware/verify-jwt";
import { listarArquivosUsuarioController } from "./ListarArquivosUsuarioController";

export async function arquivosRoutes(app: FastifyInstance) {
  app.get(
    "/arquivos",
    { onRequest: [verifyJWT] },
    listarArquivosUsuarioController
  );
}