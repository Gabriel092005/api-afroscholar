import prisma from "@/lib/prisma";
import { getMonth, getYear } from "date-fns";

export type EstadoBot = "ACTIVO" | "INACTIVO";

export interface BotAdminItem {
  id:          string;
  nome:        string;
  funcao:      string;
  avatar:      string | null;
  estado:      EstadoBot;           // baseado em Bot.status (ON | OFF)
  empresaId:   string | null;       // empresa com alocação activa (se existir)
  empresaNome: string | null;       // null se o bot não estiver alocado a nenhuma empresa
  custoApi:    number;              // soma custo_api_real do mês actual
  receita:     number;              // soma valor_cobrado do mês actual
  lucro:       number;              // receita - custoApi
}

export interface BotAdminSummary {
  totalBots:     number;
  botsAtivos:    number;            // status ON
  custoApiTotal: number;
  receitaGerada: number;
  lucroLiquido:  number;
}

export interface GetBotsAdminResponse {
  summary: BotAdminSummary;
  bots:    BotAdminItem[];
}

export class GetBotsAdminUseCase {
  async execute(filtros?: {
    search?: string;
    estado?: EstadoBot;
  }): Promise<GetBotsAdminResponse> {
    const mes = getMonth(new Date()) + 1;
    const ano = getYear(new Date());


    const bots = await prisma.bot.findMany({
      include: {
        contratos: {
          where:   { status: "ACTIVA" },
          include: {
            empresa:    { select: { id: true, nome: true } },
            folhas_pag: { where: { mes, ano } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    let lista: BotAdminItem[] = bots.map((bot) => {

      const custoApi = bot.contratos.reduce(
        (sum, c) => sum + c.folhas_pag.reduce((s, f) => s + Number(f.custo_api_real ?? 0), 0),
        0
      );
      const receita = bot.contratos.reduce
      (
        (sum, c) => sum + c.folhas_pag.reduce((s, f) => s + Number(f.valor_cobrado ?? 0), 0),
        0
      );

      const contrato = bot.contratos[0] ?? null;

      return {
        id:          bot.id,
        nome:        bot.nome,
        funcao:      bot.funcao,
        avatar:      bot.avatar_url ?? null,
        estado:      bot.status === "ON" ? "ACTIVO" : "INACTIVO",
        empresaId:   contrato?.empresa.id   ?? null,
        empresaNome: contrato?.empresa.nome ?? null,
        custoApi,
        receita,
        lucro: receita - custoApi,
      };
    });

    if (filtros?.search) {
      const q = filtros.search.toLowerCase();
      lista = lista.filter(
        (b) =>
          b.nome.toLowerCase().includes(q) ||
          b.funcao.toLowerCase().includes(q) ||
          b.empresaNome?.toLowerCase().includes(q)
      );
    }

    if (filtros?.estado) {
      lista = lista.filter((b) => b.estado === filtros.estado);
    }

    const [totalBots, botsAtivos, finMes] = await Promise.all([
      prisma.bot.count(),
      prisma.bot.count({ where: { status: "ON" } }),
      prisma.folhaBot.aggregate({
        where: { mes, ano },
        _sum:  { valor_cobrado: true, custo_api_real: true },
      }),
    ]);

    const receitaGerada = Number(finMes._sum.valor_cobrado  ?? 0);
    const custoApiTotal = Number(finMes._sum.custo_api_real ?? 0);

    return {
      summary: {
        totalBots,
        botsAtivos,
        custoApiTotal,
        receitaGerada,
        lucroLiquido: receitaGerada - custoApiTotal,
      },
      bots: lista,
    };
  }
}