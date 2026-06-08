import prisma from "@/lib/prisma";


interface CreateFeedbackInput {
  rating: number;
  comentario: string;
  nome_exibicao: string;
  cargo_exibicao: string;
  usuarioId: string;
  botId: string;
}

export async function createFeedbackUseCase(data: CreateFeedbackInput) {
  // 1. Criar o feedback no banco
  const feedback = await prisma.feedback.create({
    data: {
      rating: data.rating,
      comentario: data.comentario,
      nome_exibicao: data.nome_exibicao,
      cargo_exibicao: data.cargo_exibicao,
      usuarioId: data.usuarioId,
      botId: data.botId,
    },
  });

  // 2. Recalcular a média de rating do Bot
  const aggregate = await prisma.feedback.aggregate({
    where: { botId: data.botId },
    _avg: { rating: true },
  });

  // 3. Atualizar o rating no modelo Bot para exibição rápida no Marketplace
  await prisma.bot.update({
    where: { id: data.botId },
    data: { rating: aggregate._avg.rating || 0 },
  });

  return feedback;
}

export async function listFeedbacksByBotUseCase(botId: string) {
  return await prisma.feedback.findMany({
    where: { botId },
    orderBy: { created_at: "desc" },
    include: {
      usuario: {
        select: { image_path: true }
      }
    }
  });
}