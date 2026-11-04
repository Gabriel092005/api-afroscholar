import fs from "node:fs";
import { FastifyReply, FastifyRequest } from "fastify";
import { caminhoDoFicheiro, eLinkExterno, lerLeitor, podeAbrirDocumento } from "@/lib/documentos";
import prisma from "@/lib/prisma";

/** O único caminho para abrir um documento: confere o acesso antes de entregar o ficheiro. */
export const abrirFicheiroDocumento = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const documento = await prisma.documento.findUnique({ where: { id } });
    if (!documento) return res.status(404).send({ message: "Documento não encontrado." });

    const leitor = await lerLeitor(req);
    if (!podeAbrirDocumento(documento, leitor)) {
      return res.status(403).send({
        message: documento.preco > 0
          ? `Compre o documento "${documento.titulo}" para o abrir.`
          : "Não tem acesso a este documento.",
      });
    }

    if (eLinkExterno(documento.fileUrl)) return res.redirect(documento.fileUrl);

    const caminho = caminhoDoFicheiro(documento.fileUrl);
    if (!caminho || !fs.existsSync(caminho)) {
      return res.status(404).send({ message: "O ficheiro deste documento não foi encontrado." });
    }

    return res
      .type(documento.fileType || "application/octet-stream")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(documento.fileName || documento.titulo)}`)
      .header("X-Content-Type-Options", "nosniff")
      .send(fs.createReadStream(caminho));
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: "Erro ao abrir o documento." });
  }
};
