import { FastifyInstance } from "fastify";
import { listBolsas } from "./list-bolsas-controller";
import { listBolsasDestaques } from "./list-bolsas-destaques-controller";
import { getBolsa } from "./get-bolsa-controller";
import { createBolsa } from "./create-bolsa-controller";
import { updateBolsa } from "./update-bolsa-controller";
import { deleteBolsa } from "./delete-bolsa-controller";
import { inscribirBolsa } from "./inscrever-bolsa-controller";
import { listConsultoriaSlots } from "./list-consultoria-slots-controller";
import { listMinhasInscricoes } from "./list-minhas-inscricoes-controller";
import { getInscricao } from "./get-inscricao-controller";
import { cancelarInscricao } from "./cancelar-inscricao-controller";
import { avaliarInscricao } from "./avaliar-inscricao-controller";
import { listInscricoesAdmin } from "./list-inscricoes-admin-controller";
import { chatBolsa } from "./chat-bolsa-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function bolsasRoutes(fastify: FastifyInstance) {
  fastify.get("/bolsas", listBolsas);
  fastify.get("/bolsas/destaques", listBolsasDestaques);
  fastify.get("/bolsas/:id", getBolsa);
  fastify.post("/bolsas", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, createBolsa);
  fastify.put("/bolsas/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, updateBolsa);
  fastify.delete("/bolsas/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, deleteBolsa);

  fastify.post("/bolsas/:id/inscrever", { onRequest: [verifyJWT] }, inscribirBolsa);
  fastify.get("/bolsas/:id/consultoria/slots", listConsultoriaSlots);
  fastify.post("/bolsas/chat", { onRequest: [verifyJWT] }, chatBolsa);

  fastify.get("/inscricoes", { onRequest: [verifyJWT] }, listMinhasInscricoes);
  fastify.get("/inscricoes/:id", { onRequest: [verifyJWT] }, getInscricao);
  fastify.put("/inscricoes/:id/cancelar", { onRequest: [verifyJWT] }, cancelarInscricao);

  fastify.get("/admin/inscricoes", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, listInscricoesAdmin);
  fastify.put("/inscricoes/:id/avaliar", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, avaliarInscricao);
}