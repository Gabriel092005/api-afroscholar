import { eLinkExterno, lerLeitor, podeAbrirDocumento } from "@/lib/documentos";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listDocumentosGestor = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const userId = req.user.sub;
    const { search, status, page = "1", limit = "20" } = req.query as any;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const where: any = user?.role === "ADMIN" ? {} : { criadoPorId: userId };

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: "insensitive" } },
        { descricao: { contains: search, mode: "insensitive" } },
        { categoria: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "TODOS") where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [documentos, total] = await Promise.all([
      prisma.documento.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: parseInt(limit),
        include: {
          criadoPor: { select: { id: true, nome: true, email: true } },
          bolsa: { select: { id: true, titulo: true } },
          _count: { select: { compras: { where: { status: "APROVADO" } } } },
        },
      }),
      prisma.documento.count({ where }),
    ]);

    return res.send({
      data: documentos,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar os documentos.",
    });
  }
};

export const listDocumentosPublicos = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { search, categoria } = req.query as any;

    // A rota é pública: sem sessão válida, só se veem os documentos sem bolsa.
    const leitor = await lerLeitor(req);
    const eStaff = leitor.role === "ADMIN" || leitor.role === "GESTOR";

    const where: any = {
      AND: [
        { OR: [{ status: "PUBLICADO" }, { id: { in: [...leitor.comprados] } }] },
        ...(eStaff ? [] : [{ OR: [{ bolsaId: null }, { bolsaId: { in: leitor.bolsas } }] }]),
      ],
    };

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: "insensitive" } },
        { descricao: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoria) where.categoria = categoria;

    const documentos = await prisma.documento.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        criadoPor: { select: { id: true, nome: true } },
        bolsa: { select: { id: true, titulo: true } },
      },
    });

    const pendentes = leitor.id
      ? await prisma.documentoCompra.findMany({
          where: { usuarioId: leitor.id, status: "PENDENTE" },
          select: { documentoId: true },
        })
      : [];
    const emPagamento = new Set(pendentes.map((p) => p.documentoId));

    // O caminho do ficheiro nunca sai daqui: abre-se por /documentos/:id/ficheiro, que confere o acesso.
    return res.send(
      documentos.map(({ fileUrl, ...documento }) => ({
        ...documento,
        linkExterno: eLinkExterno(fileUrl) ? fileUrl : null,
        temAcesso: podeAbrirDocumento(documento, leitor),
        pagamentoPendente: emPagamento.has(documento.id),
      }))
    );
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar os documentos.",
    });
  }
};
