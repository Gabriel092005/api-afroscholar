import prisma from "@/lib/prisma";

interface GeneratePayrollRequest {
  empresaId: string;
  mes: number;
  ano: number;
}

export class GeneratePayrollUseCase {
  async execute({ empresaId, mes, ano }: GeneratePayrollRequest) {

    const contratos = await prisma.botEmpresa.findMany({
      where: {
        empresaId,
        status: 'ACTIVA',
      },
      include: {
        bot: true,
      },
    });
    const registros = await Promise.all(
      contratos.map(async (contrato) => {
        const existeFolha = await prisma.folhaBot.findFirst({
          where: 
          {
             botEmpresaId: contrato.id,
             mes,
             ano
          } 
        });

        if (existeFolha) return existeFolha;
        return prisma.folhaBot.create({
          data: {
            botEmpresaId: contrato.id,
            mes,
            ano,
            valor_cobrado: contrato.bot.preco_mensal,
            custo_api_real: 0,
            horas_uso: 0,
          },
        });
      })
    );
    const totalFatura = registros.reduce((acc, curr) => acc + Number(curr.valor_cobrado), 0);
    return {
      mes,
      ano,
      itens: registros,
      total: totalFatura,
    };
  }
}