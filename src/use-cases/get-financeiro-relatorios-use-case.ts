import prisma from "@/lib/prisma";


export class GetFinanceiroRelatoriosUseCase {


  async execute() {
    // 1. Buscamos todos os bots e suas relações financeiras
    const bots = await prisma.bot.findMany({
      include: {
        assinaturas: {
          where: { status: 'APROVADO' } // Apenas o que foi pago/aprovado
        },
        contratos: {
          include: {
            folhas_pag: true // Onde estão os custos de API reais
          }
        }
      }
    });

    // 2. Mapeamos os dados para o formato do Ranking (Barra de progresso)
    const ranking = bots.map((bot) => {
      // Receita: Soma de todas as assinaturas vinculadas a este bot
      const receitaTotal = bot.assinaturas.reduce(
        (acc, sub) => acc + Number(sub.valorContrato), 
        0
      );

      // Custo: Soma de todos os custos de API das folhas de pagamento
      const custoTotal = bot.contratos.reduce((acc, contrato) => {
        const custoFolhas = contrato.folhas_pag.reduce(
          (fAcc, folha) => fAcc + Number(folha.custo_api_real), 
          0
        );
        return acc + custoFolhas;
      }, 0);

      const lucro = receitaTotal - custoTotal;

      return {
        id: bot.id,
        nome: bot.nome,
        funcao: bot.funcao,
        custo: custoTotal,
        receita: receitaTotal,
        lucro: lucro,
        // Define a cor da barra (roxo para lucro, vermelho para prejuízo)
        isPrejuizo: lucro < 0 
      };
    });

    // Ordenar pelo maior lucro (Ranking)
    const rankingOrdenado = ranking.sort((a, b) => b.lucro - a.lucro);

    // 3. Totais para o "Resumo do Período" (Cards de baixo)
    const totalReceitaGlobal = ranking.reduce((acc, item) => acc + item.receita, 0);
    const totalCustoApiGlobal = ranking.reduce((acc, item) => acc + item.custo, 0);
    const lucroLiquidoGlobal = totalReceitaGlobal - totalCustoApiGlobal;
    
    // Margem = (Lucro / Receita) * 100
    const margemGlobal = totalReceitaGlobal > 0 
      ? (lucroLiquidoGlobal / totalReceitaGlobal) * 100 
      : 0;

    return {
      ranking: rankingOrdenado,
      resumo: {
        receita: totalReceitaGlobal,
        custoApi: totalCustoApiGlobal,
        lucroLiquido: lucroLiquidoGlobal,
        margem: margemGlobal.toFixed(1)
      }
    };
  }
}