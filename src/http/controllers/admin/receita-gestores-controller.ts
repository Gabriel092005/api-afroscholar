import { startOfMonth } from "date-fns";
import { faturacaoPorBolsa, faturacaoPorCurso, faturacaoPorDocumento, type Faturacao } from "@/lib/faturacao";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

type Soma = { total: number; mes: number; pagamentos: number };

const somaVazia = (): Soma => ({ total: 0, mes: 0, pagamentos: 0 });

function acrescentar(soma: Soma, item: Soma) {
  soma.total += item.total;
  soma.mes += item.mes;
  soma.pagamentos += item.pagamentos;
}

/** Mentorias sem bolsa não têm dono: o dinheiro entra no total, mas em nenhum gestor. */
async function receitaDeMentoriasSemBolsa(): Promise<Soma> {
  const inscricoes = await prisma.mentoriaInscricao.findMany({
    where: { mentoria: { bolsaId: null } },
    select: { id: true },
  });

  const cobrancas = await prisma.pagamentoMomenu.findMany({
    where: { status: "PAGO", tipo: "MENTORIA", alvoId: { in: inscricoes.map((i) => i.id) } },
    select: { valor: true, pagoEm: true, created_at: true },
  });

  const inicioDoMes = startOfMonth(new Date());
  const soma = somaVazia();
  for (const cobranca of cobrancas) {
    soma.total += cobranca.valor;
    soma.pagamentos += 1;
    if ((cobranca.pagoEm ?? cobranca.created_at) >= inicioDoMes) soma.mes += cobranca.valor;
  }
  return soma;
}

export const getReceitaGestores = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const [bolsas, cursos, documentos, donosBolsas, donosCursos, donosDocumentos, gestores, mentoriasSemBolsa] = await Promise.all([
      faturacaoPorBolsa({}),
      faturacaoPorCurso({}),
      faturacaoPorDocumento({}),
      prisma.bolsa.findMany({ select: { id: true, criadoPorId: true } }),
      prisma.curso.findMany({ select: { id: true, criadoPorId: true } }),
      prisma.documento.findMany({ select: { id: true, criadoPorId: true } }),
      prisma.user.findMany({
        where: { role: "GESTOR" },
        select: { id: true, nome: true, email: true, image_path: true, role: true },
      }),
      receitaDeMentoriasSemBolsa(),
    ]);

    const donoDaBolsa = new Map(donosBolsas.map((b) => [b.id, b.criadoPorId]));
    const donoDoCurso = new Map(donosCursos.map((c) => [c.id, c.criadoPorId]));
    const donoDoDocumento = new Map<string, string | null>(donosDocumentos.map((d) => [d.id, d.criadoPorId]));

    const receitaPorDono = new Map<string, Soma & { bolsas: number; cursos: number; documentos: number }>();
    const semGestor = somaVazia();

    const distribuir = (itens: Faturacao[], dono: Map<string, string | null>, campo: "bolsas" | "cursos" | "documentos") => {
      for (const item of itens) {
        const donoId = dono.get(item.id);
        if (!donoId) {
          acrescentar(semGestor, item);
          continue;
        }
        const soma = receitaPorDono.get(donoId) ?? { ...somaVazia(), bolsas: 0, cursos: 0, documentos: 0 };
        acrescentar(soma, item);
        soma[campo] += item.total;
        receitaPorDono.set(donoId, soma);
      }
    };
    distribuir(bolsas, donoDaBolsa, "bolsas");
    distribuir(cursos, donoDoCurso, "cursos");
    distribuir(documentos, donoDoDocumento, "documentos");
    acrescentar(semGestor, mentoriasSemBolsa);

    // Quem deixou de ser gestor continua na lista, se tiver gerado receita.
    const idsConhecidos = new Set(gestores.map((g) => g.id));
    const outrosDonos = await prisma.user.findMany({
      where: { id: { in: [...receitaPorDono.keys()].filter((id) => !idsConhecidos.has(id)) } },
      select: { id: true, nome: true, email: true, image_path: true, role: true },
    });

    const linhas = [];
    for (const utilizador of [...gestores, ...outrosDonos]) {
      const soma = receitaPorDono.get(utilizador.id) ?? { ...somaVazia(), bolsas: 0, cursos: 0, documentos: 0 };
      // O que a administração publicou não é receita de um gestor.
      if (utilizador.role === "ADMIN") {
        acrescentar(semGestor, soma);
        continue;
      }
      linhas.push({
        id: utilizador.id,
        nome: utilizador.nome,
        email: utilizador.email,
        image_path: utilizador.image_path,
        ...soma,
      });
    }
    linhas.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt"));

    const total = somaVazia();
    for (const linha of linhas) acrescentar(total, linha);
    const totalGestores = { ...total };
    acrescentar(total, semGestor);

    return res.send({ ...total, totalGestores: totalGestores.total, gestores: linhas, semGestor });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao carregar a receita dos gestores.",
    });
  }
};
