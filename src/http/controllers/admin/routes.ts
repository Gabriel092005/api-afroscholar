import { FastifyInstance } from "fastify";
import { getAdminDashboard } from "./dashboard-controller";
import { listAllAulasAdmin } from "./list-aulas-admin-controller";
import { deleteUsuario } from "./delete-usuario-controller";
import { deleteInscricao } from "./delete-inscricao-controller";
import { deletePagamento } from "./delete-pagamento-controller";
import { deleteMentoria } from "./delete-mentoria-controller";
import { deleteMentoriaInscricao } from "./delete-mentoria-inscricao-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/dashboard", {
    onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")],
  }, getAdminDashboard);

  fastify.get("/admin/aulas", {
    onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")],
  }, listAllAulasAdmin);

  fastify.delete("/admin/usuarios/:id", {
    onRequest: [verifyJWT, verifyUserRole("ADMIN")],
  }, deleteUsuario);

  fastify.delete("/admin/inscricoes/:id", {
    onRequest: [verifyJWT, verifyUserRole("ADMIN")],
  }, deleteInscricao);

  fastify.delete("/admin/pagamentos/:id", {
    onRequest: [verifyJWT, verifyUserRole("ADMIN")],
  }, deletePagamento);

  fastify.delete("/admin/mentorias/:id", {
    onRequest: [verifyJWT, verifyUserRole("ADMIN")],
  }, deleteMentoria);

  fastify.delete("/admin/mentorias-inscricoes/:id", {
    onRequest: [verifyJWT, verifyUserRole("ADMIN")],
  }, deleteMentoriaInscricao);
}
