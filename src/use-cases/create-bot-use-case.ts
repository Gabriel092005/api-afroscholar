import prisma from "@/lib/prisma";
import { io } from "@/server";
import { BOT_STATE } from "@/generated/enums";


interface BotVideoInput {
  video_path: string;
  estado: BOT_STATE;
}

interface CreateBotRequest {
  nome: string;
  funcao: string;
  descricao: string;
  preco_mensal: number;
  custo_api_est: number;
  tags: string[];
  videos: BotVideoInput[];
}

export class CreateBotUseCase {
  async execute(data: CreateBotRequest) {
    const bot = await prisma.bot.create({
      data: {
        nome: data.nome,
        funcao: data.funcao,
        descricao: data.descricao,
        preco_mensal: data.preco_mensal,
        custo_api_est: data.custo_api_est,
        tags: data.tags,
        assets: {
          create: data.videos.map(video => ({
            video_path: video.video_path,
            estado: video.estado,
            mime_type: "video/mp4",
          })),
        },
      },
      include: { assets: true },
    });

    // 2. Busca todos os GESTOREs activos
    const gestores = await prisma.usuario.findMany({
      where: {
        role: "GESTOR",
        estado_conta: "ACTIVA",
      },
      select: { id: true },
    });

    // 3. Cria notificação no DB para cada gestor e emite via socket
    const notificacoes = await Promise.all(
      gestores.map(gestor =>
        prisma.notificacao.create({
          data: {
            titulo: "Novo bot disponível",
            conteudo: `O bot "${bot.nome}" (${bot.funcao}) já está disponível no marketplace.`,
            tipo: "BOT",
            link: `/marketplaces/details-bot/${bot.id}`,
            entidade: "bot",
            entidadeId: bot.id,
            usuarioId: gestor.id,
          },
        })
      )
    );
    gestores.forEach((gestor, i) => {
      io.to(gestor.id).emit("nova_notificacao", {
        id:          notificacoes[i].id,
        titulo:      notificacoes[i].titulo,
        conteudo:    notificacoes[i].conteudo,
        tipo:        notificacoes[i].tipo,
        link:        notificacoes[i].link,
        entidade:    notificacoes[i].entidade,
        entidadeId:  notificacoes[i].entidadeId,
        visualizada: false,
        created_at:  notificacoes[i].created_at,
      });
    });

    return bot;
  }
}