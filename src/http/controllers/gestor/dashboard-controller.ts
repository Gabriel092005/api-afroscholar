import { faturacaoPorBolsa, faturacaoPorDocumento } from "@/lib/faturacao";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { endOfMonth, getMonth, startOfMonth, subMonths } from "date-fns";

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const getGestorDashboard = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const userId = req.user.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, nome: true },
    });

    const isAdmin = user?.role === "ADMIN";
    const bolsaWhere = isAdmin ? {} : { criadoPorId: userId };
    const cursoWhere = isAdmin ? {} : { criadoPorId: userId };
    const inscricaoWhere = isAdmin ? {} : { bolsa: { criadoPorId: userId } };
    const pagamentoWhere = isAdmin ? {} : { curso: { criadoPorId: userId } };
    const documentoWhere = isAdmin ? {} : { criadoPorId: userId };

    const [bolsas, cursos, inscricoes, pagamentos, documentos, totalEstudantes, ultimasBolsas, ultimosCursos, cursosPopulares] =
      await Promise.all([
        prisma.bolsa.findMany({
          where: bolsaWhere,
          select: { id: true, status: true, created_at: true },
        }),
        prisma.curso.findMany({
          where: cursoWhere,
          select: { id: true, titulo: true, categoria: true, status: true, estudantes: true, preco: true, created_at: true },
        }),
        prisma.bolsaInscricao.findMany({
          where: inscricaoWhere,
          select: { id: true, status: true, tipoInteresse: true, valorPago: true, created_at: true },
        }),
        prisma.cursoPagamento.findMany({
          where: pagamentoWhere,
          select: { id: true, status: true, valor: true, created_at: true },
        }),
        prisma.documento.findMany({
          where: documentoWhere,
          select: { id: true, status: true },
        }),
        isAdmin
          ? prisma.cursoUsuario.count()
          : prisma.cursoUsuario.count({ where: { curso: { criadoPorId: userId } } }),
        prisma.bolsa.findMany({
          where: bolsaWhere,
          orderBy: { created_at: "desc" },
          take: 5,
          select: {
            id: true,
            titulo: true,
            status: true,
            pais: true,
            prazo: true,
            created_at: true,
            _count: { select: { inscricoes: true } },
          },
        }),
        prisma.curso.findMany({
          where: cursoWhere,
          orderBy: { created_at: "desc" },
          take: 5,
          select: {
            id: true,
            titulo: true,
            status: true,
            estudantes: true,
            preco: true,
            created_at: true,
            _count: { select: { compras: true } },
          },
        }),
        prisma.curso.findMany({
          where: cursoWhere,
          orderBy: { estudantes: "desc" },
          take: 5,
          select: { id: true, titulo: true, estudantes: true, preco: true },
        }),
      ]);

    const bolsasPublicadas = bolsas.filter((b) => b.status === "PUBLICADA").length;
    const bolsasRascunho = bolsas.filter((b) => b.status === "RASCUNHO").length;
    const bolsasInativas = bolsas.filter((b) => b.status === "INATIVA").length;
    const cursosPublicados = cursos.filter((c) => c.status === "PUBLICADO").length;
    const cursosRascunho = cursos.filter((c) => c.status === "RASCUNHO").length;

    const inscricoesAprovadas = inscricoes.filter((i) => i.status === "APROVADA").length;
    const inscricoesPendentes = inscricoes.filter((i) => i.status === "PENDENTE").length;
    const inscricoesRejeitadas = inscricoes.filter((i) => i.status === "REJEITADA").length;
    const inscricoesCanceladas = inscricoes.filter((i) => i.status === "CANCELADA").length;
    const receitaInscricoes = (await faturacaoPorBolsa(bolsaWhere)).reduce((acc, b) => acc + b.total, 0);

    const pagamentosAprovados = pagamentos.filter((p) => p.status === "APROVADO").length;
    const pagamentosPendentes = pagamentos.filter((p) => p.status === "PENDENTE").length;
    const receitaCursos = pagamentos
      .filter((p) => p.status === "APROVADO")
      .reduce((acc, p) => acc + Number(p.valor ?? 0), 0);

    const documentosPublicados = documentos.filter((d) => d.status === "PUBLICADO").length;
    const receitaDocumentos = (await faturacaoPorDocumento(documentoWhere)).reduce((acc, d) => acc + d.total, 0);

    const agora = new Date();
    const crescimentoMensal = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(agora, 5 - i);
      const inicio = startOfMonth(d);
      const fim = endOfMonth(d);
      const noPeriodo = (date: Date) => date >= inicio && date <= fim;
      return {
        month: MESES_PT[getMonth(d)],
        bolsas: bolsas.filter((b) => noPeriodo(new Date(b.created_at))).length,
        cursos: cursos.filter((c) => noPeriodo(new Date(c.created_at))).length,
        inscricoes: inscricoes.filter((i) => noPeriodo(new Date(i.created_at))).length,
      };
    });

    const cursosPorCategoria = cursos.reduce<Record<string, number>>((acc, curso) => {
      const categoria = curso.categoria || "Sem categoria";
      acc[categoria] = (acc[categoria] ?? 0) + 1;
      return acc;
    }, {});

    return res.send({
      gestor: { nome: user?.nome ?? "", role: user?.role ?? "GESTOR" },
      metrics: {
        bolsasTotal: bolsas.length,
        bolsasPublicadas,
        bolsasRascunho,
        bolsasInativas,
        cursosTotal: cursos.length,
        cursosPublicados,
        cursosRascunho,
        inscricoesTotal: inscricoes.length,
        inscricoesPendentes,
        inscricoesAprovadas,
        inscricoesRejeitadas,
        inscricoesCanceladas,
        consultorias: inscricoes.filter((i) => i.tipoInteresse === "CONSULTORIA").length,
        mentorias: inscricoes.filter((i) => i.tipoInteresse === "MENTORIA").length,
        receitaInscricoes,
        pagamentosAprovados,
        pagamentosPendentes,
        receitaCursos,
        estudantes: totalEstudantes,
        documentosTotal: documentos.length,
        documentosPublicados,
        receitaDocumentos,
        receitaTotal: receitaInscricoes + receitaCursos + receitaDocumentos,
      },
      crescimentoMensal,
      ultimasBolsas: ultimasBolsas.map((b) => ({
        id: b.id,
        titulo: b.titulo,
        status: b.status,
        pais: b.pais,
        prazo: b.prazo,
        created_at: b.created_at,
        inscricoes: b._count.inscricoes,
      })),
      ultimosCursos: ultimosCursos.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        status: c.status,
        estudantes: c.estudantes,
        preco: c.preco,
        created_at: c.created_at,
        compras: c._count.compras,
      })),
      cursosPopulares: cursosPopulares.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        estudantes: c.estudantes,
        receita: Number(c.preco) * c.estudantes,
      })),
      cursosPorCategoria: Object.entries(cursosPorCategoria).map(([nome, total]) => ({ nome, total })),
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao carregar o painel do gestor.",
    });
  }
};
