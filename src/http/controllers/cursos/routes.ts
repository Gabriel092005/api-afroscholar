import { FastifyInstance } from "fastify";
import { listCursos } from "./list-cursos-controller";
import { getCurso } from "./get-curso-controller";
import { createCurso } from "./create-curso-controller";
import { updateCurso } from "./update-curso-controller";
import { deleteCurso } from "./delete-curso-controller";
import { publishCurso } from "./publish-curso-controller";
import { addAula } from "./add-aula-controller";
import { removeAula } from "./remove-aula-controller";
import { aderirCurso } from "./aderir-curso-controller";
import { listMeusCursos } from "./list-meus-cursos-controller";
import { listMeusPagamentos } from "./meus-pagamentos-controller";
import { listPagamentos } from "./list-pagamentos-controller";
import { avaliarPagamento } from "./avaliar-pagamento-controller";
import { getPagamento } from "./get-pagamento-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function cursosRoutes(fastify: FastifyInstance) {
  // ── Static routes FIRST (evita conflito com :id) ──
  fastify.get("/cursos", listCursos);
  fastify.get("/cursos/comprados", { onRequest: [verifyJWT] }, listMeusCursos);

  // ── Admin-only management routes ──
  fastify.post("/cursos", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, createCurso);

  // ── Routes with :id parameter ──
  fastify.get("/cursos/:id", getCurso);
  fastify.put("/cursos/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, updateCurso);
  fastify.delete("/cursos/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, deleteCurso);
  fastify.post("/cursos/:id/publicar", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, publishCurso);
  fastify.post("/cursos/:id/aderir", { onRequest: [verifyJWT] }, aderirCurso);

  // ── Nested routes ──
  fastify.post("/cursos/:cursoId/aulas", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, addAula);
  fastify.delete("/cursos/:cursoId/aulas/:aulaId", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, removeAula);

  // ── Admin-only payment routes ──
  fastify.get("/cursos/pagamentos", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, listPagamentos);
  fastify.get("/cursos/pagamentos/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, getPagamento);
  fastify.put("/cursos/pagamentos/:id/avaliar", { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, avaliarPagamento);

  fastify.get("/meus-pagamentos", { onRequest: [verifyJWT] }, listMeusPagamentos);
}