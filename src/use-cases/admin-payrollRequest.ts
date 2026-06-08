// src/use-cases/admin-payrollRequest.ts
import prisma from "@/lib/prisma";

interface GetPayrollRequest {
  usuarioId: string;
  mes: number;
  ano: number;
}

export class GetPayrollSummaryUseCase {
  async execute({ usuarioId, mes, ano }: GetPayrollRequest) {
    const folhas = await prisma.folhaBot.findMany({
      where: {
        mes,
        ano,
        botEmpresa: {
          empresa: {
            usuarioId: usuarioId
          }
        }
      },
      include: {
        botEmpresa: {
          include: {
            bot: true,
            departamento: true
          }
        }
      }
    });

    // Cálculos com conversão para Number para facilitar a resposta JSON
    const totalPago = folhas.reduce((acc, f) => acc + Number(f.valor_cobrado), 0);
    const custoApiTotal = folhas.reduce((acc, f) => acc + Number(f.custo_api_real), 0);
    const lucroLiquido = totalPago - custoApiTotal;

    const itens = folhas.map(f => ({
      id: f.id,
      botNome: f.botEmpresa.bot.nome,
      funcao: f.botEmpresa.bot.funcao,
      custoApi: Number(f.custo_api_real),
      receitaGerada: Number(f.valor_cobrado),
      totalPago: Number(f.valor_cobrado),
      avatar: f.botEmpresa.bot.avatar_url
    }));

    return {
      metrics: {
        totalBots: itens.length,
        totalPago,
        custoApiTotal,
        lucroLiquido,
        periodoReferencia: { mes, ano } // Útil para o frontend saber o que está sendo exibido
      },
      itens
    };
  }
}