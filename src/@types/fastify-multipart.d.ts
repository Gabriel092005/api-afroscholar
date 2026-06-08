// src/@types/fastify-multipart.d.ts
import '@fastify/multipart';

declare module 'fastify' {
  interface FastifyRequest {
    isMultipart(): boolean;
    parts(): AsyncIterableIterator<import('@fastify/multipart').Multipart>;
  }
}