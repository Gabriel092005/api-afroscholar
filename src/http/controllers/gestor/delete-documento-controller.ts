import { apagarFicheiroPrivado } from "@/lib/documentos";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteDocumento = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user.sub;

    const [documento, user] = await Promise.all([
      prisma.documento.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);

    if (!documento) {
      return res.status(404).send({ message: "Documento não encontrado." });
    }

    if (user?.role !== "ADMIN" && documento.criadoPorId !== userId) {
      return res.status(403).send({ message: "Não tem permissão para excluir este documento." });
    }

    // Uma referência pendente ainda pode ser paga, por isso também conta.
    const compras = await prisma.documentoCompra.count({
      where: { documentoId: id, status: { in: ["APROVADO", "PENDENTE"] } },
    });
    if (compras > 0) {
      return res.status(409).send({
        message: "Este documento tem compras e não pode ser excluído: quem pagou mantém o acesso. Passe-o a rascunho para deixar de o vender.",
      });
    }

    await prisma.documento.delete({ where: { id } });
    await apagarFicheiroPrivado(documento.fileUrl).catch((e) => req.log.error(e));

    return res.send({ message: "Documento excluído com sucesso" });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao excluir documento.",
    });
  }
};
