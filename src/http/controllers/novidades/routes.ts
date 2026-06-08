import { FastifyInstance } from "fastify";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";
import { createNovidadeController } from "./create";
import { fetchNovidadesController } from "./fetch-novidades";
import { getNovidadeDetailsController } from "./get-novidade";
import { updateNovidadeController } from "./update";
import { deleteNovidadeController } from "./delete";
import { inscreverNovidadeController } from "./inscrever-novidade";

export function NovidadesRoutes(app: FastifyInstance) {
  // Public routes
  app.get("/novidades", fetchNovidadesController);
  app.get("/novidades/:id", getNovidadeDetailsController);
  app.post(
    "/novidades/:id/inscrever",
    { onRequest: [verifyJWT] },
    inscreverNovidadeController
  );

  // Admin routes
  app.post(
    "/novidades",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    createNovidadeController
  );
  app.put(
    "/novidades/:id",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    updateNovidadeController
  );
  app.delete(
    "/novidades/:id",
    { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] },
    deleteNovidadeController
  );
}
