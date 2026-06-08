import prisma from "@/lib/prisma";

export class GetRecentBotsUseCase {


  async execute(days: number = 7) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - days);

    const recentBots = await prisma.bot.findMany({
      where: {
        created_at: {
          gte: thresholdDate, 
        },
        status: "ON", // Apenas bots ativos
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return recentBots;
  }
}