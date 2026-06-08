import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { startOfMonth, endOfMonth, subMonths, getMonth, getYear } from "date-fns";

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const getAdminDashboard = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const agora = new Date();

    const [
      totalUsuarios,
      totalCursos,
      totalBolsas,
      totalInscricoes,
      totalConsultorias,
      totalMentorias,
      totalPagamentosAprovados,
      receitaTotal,
      usuariosRecentes,
      cursosPopulares,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.curso.count(),
      prisma.bolsa.count({ where: { status: "PUBLICADA" } }),
      prisma.bolsaInscricao.count({ where: { tipoInteresse: "INSCRICAO" } }),
      prisma.bolsaInscricao.count({ where: { tipoInteresse: "CONSULTORIA" } }),
      prisma.bolsaInscricao.count({ where: { tipoInteresse: "MENTORIA" } }),
      prisma.cursoPagamento.count({ where: { status: "APROVADO" } }),
      prisma.cursoPagamento.aggregate({
        where: { status: "APROVADO" },
        _sum: { valor: true },
      }),
      prisma.user.findMany({
        orderBy: { created_at: "desc" },
        take: 5,
        select: { id: true, nome: true, email: true, image_path: true, created_at: true },
      }),
      prisma.curso.findMany({
        orderBy: { estudantes: "desc" },
        take: 5,
        select: { id: true, titulo: true, estudantes: true, preco: true },
      }),
    ]);

    const crescimentoMensal = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(agora, 5 - i);
        const inicio = startOfMonth(d);
        const fim = endOfMonth(d);
        return Promise.all([
          prisma.user.count({ where: { created_at: { gte: inicio, lte: fim } } }),
          prisma.curso.count({ where: { created_at: { gte: inicio, lte: fim } } }),
          prisma.bolsa.count({ where: { created_at: { gte: inicio, lte: fim } } }),
        ]).then(([users, courses, bolsas]) => ({
          month: MESES_PT[getMonth(d)],
          users,
          courses,
          bolsas,
        }));
      })
    );

    const statsCards = [
      { label: "Utilizadores", value: totalUsuarios, icon: "Users", color: "purple" },
      { label: "Cursos", value: totalCursos, icon: "BookOpen", color: "emerald" },
      { label: "Bolsas", value: totalBolsas, icon: "Award", color: "amber" },
      { label: "Inscrições", value: totalInscricoes, icon: "FileText", color: "blue" },
      { label: "Consultorias", value: totalConsultorias, icon: "Briefcase", color: "rose" },
      { label: "Mentorias", value: totalMentorias, icon: "GraduationCap", color: "teal" },
    ];

    return res.send({
      statsCards,
      receitaTotal: Number(receitaTotal._sum.valor ?? 0),
      totalPagamentosAprovados,
      crescimentoMensal,
      usuariosRecentes: usuariosRecentes.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        image_path: u.image_path,
        created_at: u.created_at,
      })),
      cursosPopulares: cursosPopulares.map((c) => ({
        titulo: c.titulo,
        estudantes: c.estudantes,
        receita: Number(c.preco) * c.estudantes,
      })),
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao carregar dashboard.",
    });
  }
};
