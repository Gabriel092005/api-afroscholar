import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function searchUsuarios(req: FastifyRequest, res: FastifyReply) {
  try {
    const { q } = req.query as { q?: string };
    if (!q || q.length < 2) {
      return res.send([]);
    }

    const usuarios = await prisma.user.findMany({
      where: {
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        nome: true,
        email: true,
        image_path: true,
      },
      take: 15,
      orderBy: { nome: "asc" },
    });

    return res.send(usuarios);
  } catch (error) {
    console.error("[search-usuarios]", error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao pesquisar usuários." });
  }
}
