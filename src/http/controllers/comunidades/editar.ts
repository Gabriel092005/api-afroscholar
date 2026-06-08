import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const editarSchema = z.object({
  nome: z.string().min(3).optional(),
  descricao: z.string().nullable().optional(),
  imagem: z.string().nullable().optional(),
  capa: z.string().nullable().optional(),
  bolsaId: z.string().uuid().nullable().optional(),
});

export async function editar(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;
    const body = editarSchema.parse(req.body);

    const comunidade = await prisma.community.findUnique({
      where: { id },
      select: { criadorId: true },
    });

    if (!comunidade) {
      return res.status(404).send({ error: "Not Found", message: "Comunidade não encontrada." });
    }

    const [usuario, membro] = await Promise.all([
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { role: true },
      }),
      prisma.communityMember.findUnique({
        where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
        select: { role: true },
      }),
    ]);

    const isSystemAdmin = usuario?.role === "ADMIN";
    const isCreator = comunidade.criadorId === usuarioId;
    const isCommunityAdmin = membro?.role === "ADMIN";

    if (!isSystemAdmin && !isCreator && !isCommunityAdmin) {
      return res.status(403).send({ error: "Forbidden", message: "Apenas administradores podem editar a comunidade." });
    }

    const updated = await prisma.community.update({
      where: { id },
      data: body,
      include: {
        _count: { select: { membros: { where: { status: "APROVADO" } }, mensagens: true } },
        criador: { select: { id: true, nome: true, image_path: true } },
      },
    });

    const membroAtual = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
      select: { role: true },
    });

    return res.send({
      ...updated,
      souMembro: !!membroAtual,
      meuPapel: membroAtual?.role || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao editar comunidade." });
  }
}
