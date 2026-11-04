import { FastifyInstance } from "fastify";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";
import { getGestorDashboard } from "./dashboard-controller";
import { getFaturacaoGestor } from "./faturacao-controller";
import { listMinhasBolsas } from "./list-bolsas-gestor-controller";
import { listMeusCursos } from "./list-cursos-gestor-controller";
import { listMentoriasGestor } from "./list-mentorias-gestor-controller";
import { listMinhasAulas } from "./list-aulas-gestor-controller";
import { listDocumentosGestor, listDocumentosPublicos } from "./list-documentos-controller";
import { createDocumento } from "./create-documento-controller";
import { updateDocumento } from "./update-documento-controller";
import { deleteDocumento } from "./delete-documento-controller";
import { abrirFicheiroDocumento } from "./ficheiro-documento-controller";
import { comprarDocumento } from "./comprar-documento-controller";

export async function gestorRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/gestor/dashboard",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    getGestorDashboard
  );

  fastify.get(
    "/gestor/faturacao",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    getFaturacaoGestor
  );

  fastify.get(
    "/gestor/bolsas",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    listMinhasBolsas
  );

  fastify.get(
    "/gestor/cursos",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    listMeusCursos
  );

  fastify.get(
    "/gestor/mentorias",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    listMentoriasGestor
  );

  fastify.get(
    "/gestor/aulas",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    listMinhasAulas
  );

  fastify.get("/documentos", listDocumentosPublicos);
  fastify.get("/documentos/:id/ficheiro", abrirFicheiroDocumento);
  fastify.post("/documentos/:id/comprar", { onRequest: [verifyJWT] }, comprarDocumento);

  fastify.get(
    "/gestor/documentos",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    listDocumentosGestor
  );

  fastify.post(
    "/gestor/documentos",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    createDocumento
  );

  fastify.put(
    "/gestor/documentos/:id",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    updateDocumento
  );

  fastify.delete(
    "/gestor/documentos/:id",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    deleteDocumento
  );
}
