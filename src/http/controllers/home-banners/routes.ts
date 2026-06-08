import { FastifyInstance } from "fastify";
import { listHomeBanners } from "./list-home-banners-controller";
import { createHomeBanner } from "./create-home-banner-controller";
import { deleteHomeBanner } from "./delete-home-banner-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

export async function homeBannersRoutes(fastify: FastifyInstance) {
  fastify.get("/home-banners", listHomeBanners);
  fastify.post("/home-banners", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, createHomeBanner);
  fastify.delete("/home-banners/:id", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, deleteHomeBanner);
}
