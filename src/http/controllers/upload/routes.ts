import { FastifyInstance } from "fastify";
import { uploadFile } from "./upload-controller";

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post("/upload", uploadFile);
}
