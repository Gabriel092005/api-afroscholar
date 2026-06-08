import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export function verifyUserRole(...rolesToVerify: ('ADMIN' | 'GESTOR')[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ message: 'unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { role: true },
    });

    if (!user || !rolesToVerify.includes(user.role)) {
      return reply.status(401).send({ message: 'unauthorized' });
    }
  };
}