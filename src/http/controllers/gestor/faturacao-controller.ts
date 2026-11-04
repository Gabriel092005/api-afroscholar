import { faturacaoPorBolsa, faturacaoPorCurso, faturacaoPorDocumento, type Faturacao } from "@/lib/faturacao";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

const comReceita = (itens: Faturacao[]) =>
  itens.filter((item) => item.total > 0).sort((a, b) => b.total - a.total);

export const getFaturacaoGestor = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const where = user?.role === "ADMIN" ? {} : { criadoPorId: userId };
    const [bolsas, cursos, documentos] = await Promise.all([
      faturacaoPorBolsa(where),
      faturacaoPorCurso(where),
      faturacaoPorDocumento(where),
    ]);
    const todos = [...bolsas, ...cursos, ...documentos];

    return res.send({
      total: todos.reduce((acc, item) => acc + item.total, 0),
      mes: todos.reduce((acc, item) => acc + item.mes, 0),
      pagamentos: todos.reduce((acc, item) => acc + item.pagamentos, 0),
      bolsas: comReceita(bolsas),
      cursos: comReceita(cursos),
      documentos: comReceita(documentos),
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao carregar a faturação.",
    });
  }
};
