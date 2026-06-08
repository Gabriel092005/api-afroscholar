import { FastifyInstance } from "fastify";
import { createFeedbackController, listFeedbacksController } from "./feedbacks";
import { verifyJWT } from "../middleware/verify-jwt";


export async function feedbackRoutes(app: FastifyInstance) {
  app.post("/feedbacks",{onRequest:[verifyJWT]}, createFeedbackController);
  app.get("/bots/:botId/feedbacks", listFeedbacksController);
}