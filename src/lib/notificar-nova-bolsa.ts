import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { io } from "@/server";
import { cumpreRequisitosVerificaveis } from "@/lib/elegibilidade-bolsa";
import { PushService } from "@/lib/push-service";

const PUSHES_EM_PARALELO = 50;
const TIPO_COMPATIVEL = "BOLSA_COMPATIVEL";
const TIPO_NOVA = "BOLSA_NOVA";

/** Avisa os estudantes de uma bolsa publicada, com destaque para quem cumpre os requisitos. */
export async function notificarNovaBolsa(bolsaId: string) {
  const bolsa = await prisma.bolsa.findUnique({ where: { id: bolsaId } });
  if (!bolsa) return;

  const [estudantes, jaAvisados] = await Promise.all([
    prisma.user.findMany({
      where: { estado_conta: "ACTIVA", role: "USUARIO" },
      select: { id: true, pushSubscription: true, perfilAcademico: true },
    }),
    // Uma bolsa despublicada e publicada de novo não volta a avisar as mesmas pessoas.
    prisma.notification.findMany({
      where: { entidade: "bolsa", entidadeId: bolsa.id, tipo: { in: [TIPO_COMPATIVEL, TIPO_NOVA] } },
      select: { userId: true },
    }),
  ]);

  const avisados = new Set(jaAvisados.map((n) => n.userId));
  const link = `/bolsas/${bolsa.id}`;
  const prazo = bolsa.prazo ? ` Candidate-se até ${bolsa.prazo.toLocaleDateString("pt-PT")}.` : " Candidate-se o quanto antes.";

  const notificacoes = estudantes
    .filter((e) => !avisados.has(e.id))
    .map((estudante) => {
      const compativel = cumpreRequisitosVerificaveis(bolsa, estudante.perfilAcademico);
      return {
        id: crypto.randomUUID(),
        userId: estudante.id,
        subscricao: estudante.pushSubscription,
        compativel,
        titulo: compativel ? "🎯 Cumpre os requisitos desta bolsa!" : `🎓 Nova bolsa: ${bolsa.titulo}`,
        conteudo: compativel
          ? `${bolsa.titulo}: o seu perfil cumpre os requisitos que conseguimos verificar.${prazo}`
          : bolsa.subtitulo || bolsa.descricao?.substring(0, 120) || `Há uma nova oportunidade na plataforma.${prazo}`,
        tipo: compativel ? TIPO_COMPATIVEL : TIPO_NOVA,
      };
    });

  if (notificacoes.length === 0) return;

  await prisma.notification.createMany({
    data: notificacoes.map((n) => ({
      id: n.id,
      userId: n.userId,
      titulo: n.titulo,
      content: n.conteudo,
      tipo: n.tipo,
      link,
      entidade: "bolsa",
      entidadeId: bolsa.id,
    })),
  });

  for (const n of notificacoes) {
    io?.to(n.userId).emit("nova_notificacao", {
      id: n.id,
      titulo: n.titulo,
      conteudo: n.conteudo,
      tipo: n.tipo,
      link,
      visualizada: false,
      created_at: new Date().toISOString(),
    });
  }

  const comPush = notificacoes.filter((n) => n.subscricao);
  for (let inicio = 0; inicio < comPush.length; inicio += PUSHES_EM_PARALELO) {
    await Promise.all(
      comPush.slice(inicio, inicio + PUSHES_EM_PARALELO).map((n) =>
        PushService.entregar(n.userId, n.subscricao, {
          title: n.titulo,
          body: n.conteudo,
          url: link,
          tag: `bolsa-${bolsa.id}`,
          destaque: n.compativel,
        }),
      ),
    );
  }
}
