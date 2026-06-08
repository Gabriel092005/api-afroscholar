import prisma from "@/lib/prisma";

export class FetchBotUseCase {
  async execute() {

    const bots = await prisma.bot.findMany({
        select:{
            descricao:true,
            funcao:true,
            id:true,
            nome:true,
            rating:true,
            preco_mensal:true,
            tags:true,
        }
    });
   
    return {
        bots
    };
  }
}