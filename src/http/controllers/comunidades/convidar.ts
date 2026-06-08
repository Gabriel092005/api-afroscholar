import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export async function convidar(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;

    const comunidade = await prisma.community.findUnique({ where: { id } });
    if (!comunidade) {
      return res.status(404).send({ error: "Not Found", message: "Comunidade não encontrada." });
    }

    const convidador = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
      include: { usuario: true },
    });

    if (!convidador) {
      return res.status(403).send({ error: "Forbidden", message: "Não é membro desta comunidade." });
    }

    const { usuarioId: convidadoId } = z.object({
      usuarioId: z.string().uuid(),
    }).parse(req.body);

    if (convidadoId === usuarioId) {
      return res.status(400).send({ error: "Bad Request", message: "Não pode convidar-se a si mesmo." });
    }

    const convidadoExiste = await prisma.user.findUnique({ where: { id: convidadoId } });
    if (!convidadoExiste) {
      return res.status(404).send({ error: "Not Found", message: "Usuário não encontrado." });
    }

    const membroExistente = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId: convidadoId } },
    });

    if (membroExistente) {
      return res.status(400).send({ error: "Bad Request", message: "Este usuário já é membro da comunidade." });
    }

    await prisma.communityMember.create({
      data: { comunidadeId: id, usuarioId: convidadoId },
    });

    await prisma.notification.create({
      data: {
        titulo: `Convite para ${comunidade.nome}`,
        content: `${convidador.usuario.nome || "Alguém"} convidou-o para participar em "${comunidade.nome}".`,
        tipo: "INFO",
        link: `/comunidades/${id}`,
        entidade: "comunidade",
        entidadeId: id,
        userId: convidadoId,
      },
    });

    return res.status(201).send({ message: "Usuário adicionado à comunidade." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    console.error("[convidar]", error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao convidar usuário." });
  }
}
