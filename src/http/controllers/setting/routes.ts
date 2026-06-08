import { FastifyInstance } from "fastify";
import { updateSettingsController } from "./settings-controller";
import { getExpressMessageController } from "./get-seeting-controller";

export async function settingsRoutes(app: FastifyInstance) {
  app.patch("/settings/update", updateSettingsController);
  app.get("/settings", getExpressMessageController);
}