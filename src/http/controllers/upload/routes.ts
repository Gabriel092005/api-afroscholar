import { FastifyInstance } from "fastify";
import { verifyJWT } from "../middleware/verify-jwt";
import { uploadFile } from "./upload-controller";

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post("/upload", { onRequest: [verifyJWT] }, uploadFile);
}
