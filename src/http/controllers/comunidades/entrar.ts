import { temMentoriaNaBolsa } from "@/lib/mentoria-acesso";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function entrar(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;

    const comunidade = await prisma.community.findUnique({ where: { id } });
    if (!comunidade) {
      return res.status(404).send({ error: "Not Found", message: "Comunidade não encontrada." });
    }

    const membroExistente = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    if (membroExistente) {
      if (membroExistente.status === "PENDENTE") {
        return res.status(400).send({ error: "Bad Request", message: "Já solicitou entrada nesta comunidade. Aguarde aprovação." });
      }
      if (membroExistente.status === "APROVADO") {
        return res.status(400).send({ error: "Bad Request", message: "Já é membro desta comunidade." });
      }
    }

    const usuario = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { role: true },
    });

    const isAdmin = usuario?.role === "ADMIN" || usuario?.role === "GESTOR";

    const temMentoria = comunidade.bolsaId ? await temMentoriaNaBolsa(usuarioId, comunidade.bolsaId) : false;

    if (comunidade.bolsaId && !isAdmin && !temMentoria) {
      return res.status(403).send({ error: "Forbidden", message: "Esta comunidade está incluída na mentoria da bolsa." });
    }

    if (membroExistente?.status === "REJEITADO") {
      await prisma.communityMember.delete({ where: { id: membroExistente.id } });
    }

    await prisma.communityMember.create({
      data: { comunidadeId: id, usuarioId, status: isAdmin || temMentoria ? "APROVADO" : "PENDENTE" },
    });

    if (isAdmin || temMentoria) {
      return res.status(201).send({ message: "Entrou na comunidade!" });
    }
    return res.status(201).send({ message: "Solicitação enviada. Aguarde aprovação de um administrador." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao solicitar entrada na comunidade." });
  }
}
