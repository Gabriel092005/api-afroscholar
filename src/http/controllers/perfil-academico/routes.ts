import { FastifyInstance } from "fastify";
import { salvarPerfilAcademico } from "./salvar-perfil-academico";
import { obterPerfilAcademico } from "./obter-perfil-academico";
import { verifyJWT } from "../middleware/verify-jwt";

export async function perfilAcademicoRoutes(fastify: FastifyInstance) {
  fastify.get("/perfil-academico", { onRequest: [verifyJWT] }, obterPerfilAcademico);
  fastify.put("/perfil-academico", { onRequest: [verifyJWT] }, salvarPerfilAcademico);
}
