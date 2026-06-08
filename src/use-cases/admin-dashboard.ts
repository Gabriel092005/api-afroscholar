import prisma from "@/lib/prisma";
import { getMonth, getYear, subMonths, startOfMonth, endOfMonth } from "date-fns";

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ─── Constantes de negócio ────────────────────────────────────────────────────
const META_CLIENTES   = 75;       // meta mensal de clientes
const META_FATURACAO  = 109_000;  // meta mensal de faturação em Kz

// ─── Tipos exportados ─────────────────────────────────────────────────────────
export interface KpiCards {
  faturacaoMensal:    number;
  faturacaoVariacao:  string | null; // null = sem dados do mês anterior
  clientesAtivos:     number;
  clientesVariacao:   string | null;
  totalBots:          number;
  botsNovos:          string | null;
  botsAtivos:         number;
  percentualAtivos:   number;
  custoMedioApi:      number;
  custoMedioVariacao: string | null;
}

export interface MaiorCliente {
  nome:               string;
  avatar:             string | null;
  totalBots:          number;
  ativos:             number;
  faturacao:          number;
  crescimento:        string | null;
  crescimentoPositivo: boolean;
}

export interface FaturacaoPoint {
  name:     string;
  faturacao: number;
  custo:    number;
  lucro:    number;
}

export interface CrescimentoPoint {
  name:        string;
  clientes:    number;
  assinaturas: number;
}

export interface CustoPoint {
  name:      string;
  custoMedio: number;
}

export interface MetricaRodape {
  percentual: number;
  label:      string;
}

export interface MetricasRodape {
  botsAtivos:    MetricaRodape;
  taxaOcupacao:  MetricaRodape;
  metaFaturacao: MetricaRodape;
  margemLiquida: MetricaRodape;
}

export interface DashboardData {
  metrics:               KpiCards;
  maioresClientes:       MaiorCliente[];
  chartData:             FaturacaoPoint[];
  crescimentoClientesData: CrescimentoPoint[];
  custoPorBotData:       CustoPoint[];
  metricasRodape:        MetricasRodape;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────
export class AdminDashboardService {
  async getDashboardData(): Promise<DashboardData> {
    const agora       = new Date();
    const mesAtual    = getMonth(agora) + 1;
    const anoAtual    = getYear(agora);
    const dataAnterior = subMonths(agora, 1);
    const mesAnterior  = getMonth(dataAnterior) + 1;
    const anoAnterior  = getYear(dataAnterior);

    const [cards, ranking, faturacaoGrafico, crescimentoGrafico, custoGrafico, rodape] =
      await Promise.all([
        this.getKpiCards(mesAtual, anoAtual, mesAnterior, anoAnterior),
        this.getMaioresClientes(mesAtual, anoAtual, mesAnterior, anoAnterior),
        this.getFaturacaoGrafico(),
        this.getCrescimentoClientesGrafico(),
        this.getCustoPorBotGrafico(),
        this.getMetricasRodape(mesAtual, anoAtual),
      ]);

    return {
      metrics:               cards,
      maioresClientes:       ranking,
      chartData:             faturacaoGrafico,
      crescimentoClientesData: crescimentoGrafico,
      custoPorBotData:       custoGrafico,
      metricasRodape:        rodape,
    };
  }

  // ─── KPI Cards ───────────────────────────────────────────────────────────────
  private async getKpiCards(
    mes: number, ano: number,
    mesAnt: number, anoAnt: number
  ): Promise<KpiCards> {
    const inicioMes = startOfMonth(new Date(ano, mes - 1, 1));
    const fimMes    = endOfMonth(new Date(ano, mes - 1, 1));

    const [
      totalEmpresas,
      empresasAntesMes,
      botsNovosCount,
      totalBots,
      botsAtivos,
      finAtual,
      finAnt,
      finAntCusto,
    ] = await Promise.all([
      prisma.empresa.count(),
      prisma.empresa.count({ where: { created_at: { lt: inicioMes } } }),
      prisma.bot.count({ where: { created_at: { gte: inicioMes, lte: fimMes } } }),
      prisma.bot.count(),
      prisma.bot.count({ where: { status: "ON" } }), // ← bots com status ON na tabela Bot
      prisma.folhaBot.aggregate({
        where: { mes, ano },
        _sum: { valor_cobrado: true, custo_api_real: true },
      }),
      prisma.folhaBot.aggregate({
        where: { mes: mesAnt, ano: anoAnt },
        _sum: { valor_cobrado: true },
      }),
      prisma.folhaBot.aggregate({
        where: { mes: mesAnt, ano: anoAnt },
        _sum: { custo_api_real: true },
      }),
    ]);

    const faturacaoAtual = Number(finAtual._sum.valor_cobrado  ?? 0);
    const faturacaoAnt   = Number(finAnt._sum.valor_cobrado    ?? 0);
    const custoAtual     = Number(finAtual._sum.custo_api_real ?? 0);
    const custoAnt       = Number(finAntCusto._sum.custo_api_real ?? 0);

    // Custo médio por bot activo — variação real
    const custoMedioAtual = botsAtivos > 0 ? custoAtual  / botsAtivos : 0;
    const custoMedioAnt   = botsAtivos > 0 ? custoAnt    / botsAtivos : 0;

    return {
      faturacaoMensal:    faturacaoAtual,
      faturacaoVariacao:  this.calcVariacao(faturacaoAtual, faturacaoAnt),
      clientesAtivos:     totalEmpresas,
      clientesVariacao:   this.calcVariacao(totalEmpresas, empresasAntesMes),
      totalBots,
      botsNovos:          botsNovosCount > 0 ? `+${botsNovosCount} novos` : null,
      botsAtivos,
      percentualAtivos:   totalBots > 0
        ? parseFloat(((botsAtivos / totalBots) * 100).toFixed(1))
        : 0,
      custoMedioApi:      parseFloat(custoMedioAtual.toFixed(0)),
      custoMedioVariacao: this.calcVariacao(custoMedioAtual, custoMedioAnt),
    };
  }

  // ─── Ranking de Maiores Clientes ─────────────────────────────────────────────
  private async getMaioresClientes(
    mes: number, ano: number,
    mesAnt: number, anoAnt: number
  ): Promise<MaiorCliente[]> {
    const empresas = await prisma.empresa.findMany({
      include: {
        bots_alocados: {
          include: {
            folhas_pag: {
              where: { OR: [{ mes, ano }, { mes: mesAnt, ano: anoAnt }] },
            },
          },
        },
      },
    });

    return empresas
      .map((emp) => {
        const soma = (m: number, a: number) =>
          emp.bots_alocados.reduce(
            (acc, bot) =>
              acc +
              bot.folhas_pag
                .filter((f) => f.mes === m && f.ano === a)
                .reduce((s, f) => s + Number(f.valor_cobrado), 0),
            0
          );

        const fAtual = soma(mes, ano);
        const fAnt   = soma(mesAnt, anoAnt);

        return {
          nome:    emp.nome,
          avatar:  emp.logotipo,
          totalBots: emp.bots_alocados.length,
          ativos:  emp.bots_alocados.filter((b) => b.status === "ACTIVA").length,
          faturacao:          fAtual,
          crescimento:        this.calcVariacao(fAtual, fAnt),
          crescimentoPositivo: fAtual >= fAnt,
        };
      })
      .sort((a, b) => b.faturacao - a.faturacao)
      .slice(0, 5);
  }

  // ─── Gráfico de Faturação ────────────────────────────────────────────────────
  private async getFaturacaoGrafico(): Promise<FaturacaoPoint[]> {
    return Promise.all(
      this.gerarUltimosMeses(6).map(async (m) => {
        const res = await prisma.folhaBot.aggregate({
          where: { mes: m.mes, ano: m.ano },
          _sum:  { valor_cobrado: true, custo_api_real: true },
        });
        const f = Number(res._sum.valor_cobrado  ?? 0);
        const c = Number(res._sum.custo_api_real ?? 0);
        return { name: m.label, faturacao: f, custo: c, lucro: f - c };
      })
    );
  }

  // ─── Gráfico de Crescimento de Clientes ──────────────────────────────────────
  private async getCrescimentoClientesGrafico(): Promise<CrescimentoPoint[]> {
    return Promise.all(
      this.gerarUltimosMeses(6).map(async (m) => {
        const limite = endOfMonth(new Date(m.ano, m.mes - 1));
        const [clientes, assinaturas] = await Promise.all([
          prisma.empresa.count({ where: { created_at: { lte: limite } } }),
          prisma.assinatura.count({
            where: { dataContratacao: { lte: limite }, status: "APROVADO" },
          }),
        ]);
        return { name: m.label, clientes, assinaturas };
      })
    );
  }

  // ─── Gráfico de Custo por Bot ─────────────────────────────────────────────────
  private async getCustoPorBotGrafico(): Promise<CustoPoint[]> {
    return Promise.all(
      this.gerarUltimosMeses(6).map(async (m) => {
        const res = await prisma.folhaBot.aggregate({
          where: { mes: m.mes, ano: m.ano },
          _avg:  { custo_api_real: true },
        });
        return {
          name:      m.label,
          custoMedio: parseFloat(Number(res._avg.custo_api_real ?? 0).toFixed(2)),
        };
      })
    );
  }

  // ─── Métricas do Rodapé (Progress Bars) ──────────────────────────────────────
  private async getMetricasRodape(mes: number, ano: number): Promise<MetricasRodape> {
    const [totalBots, botsAtivos, totalEmpresas, fin] = await Promise.all([
      prisma.bot.count(),
      prisma.bot.count({ where: { status: "ON" } }), // ← bots com status ON na tabela Bot
      prisma.empresa.count(),
      prisma.folhaBot.aggregate({
        where: { mes, ano },
        _sum:  { valor_cobrado: true, custo_api_real: true },
      }),
    ]);

    const faturacao = Number(fin._sum.valor_cobrado  ?? 0);
    const custo     = Number(fin._sum.custo_api_real ?? 0);

    // Taxa de ocupação — calculada a partir da meta real
    const percOcupacao = parseFloat(
      Math.min((totalEmpresas / META_CLIENTES) * 100, 100).toFixed(1)
    );

    // Meta de faturação — calculada a partir da constante
    const percFaturacao = parseFloat(
      Math.min((faturacao / META_FATURACAO) * 100, 100).toFixed(1)
    );

    // Margem líquida — percentual sobre faturação
    const margemPerc = faturacao > 0
      ? parseFloat((((faturacao - custo) / faturacao) * 100).toFixed(1))
      : 0;

    return {
      botsAtivos: {
        percentual: totalBots > 0
          ? parseFloat(((botsAtivos / totalBots) * 100).toFixed(1))
          : 0,
        label: `${botsAtivos} de ${totalBots} bots`,
      },
      taxaOcupacao: {
        percentual: percOcupacao,
        label:      `${totalEmpresas} de ${META_CLIENTES} clientes meta`,
      },
      metaFaturacao: {
        percentual: percFaturacao,
        label:      `Kz ${this.formatKz(faturacao)} de Kz ${this.formatKz(META_FATURACAO)}`,
      },
      margemLiquida: {
        percentual: margemPerc,
        label:      "Faturação menos custos",
      },
    };
  }

  // ─── Utilitários ─────────────────────────────────────────────────────────────

  /**
   * Calcula variação percentual com sinal correcto (+/-).
   * Devolve null quando não há dados do período anterior,
   * evitando o falso "+100%" quando anterior = 0.
   */
  private calcVariacao(atual: number, anterior: number): string | null {
    if (anterior <= 0) return null; // sem dados anteriores — não mostrar variação
    const diff = ((atual - anterior) / anterior) * 100;
    const sinal = diff >= 0 ? "+" : "-";
    return `${sinal}${Math.abs(Math.round(diff))}%`;
  }

  /** Formata valor em Kz (ex: 84000 → "84k") */
  private formatKz(val: number): string {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000)     return `${(val / 1_000).toFixed(0)}k`;
    return val.toString();
  }

  /** Gera array dos últimos N meses com label em português */
  private gerarUltimosMeses(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const d = subMonths(new Date(), n - 1 - i);
      return {
        mes:   getMonth(d) + 1,
        ano:   getYear(d),
        label: MESES_PT[getMonth(d)],
      };
    });
  }
}