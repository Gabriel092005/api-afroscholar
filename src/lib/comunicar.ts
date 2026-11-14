import type { Role } from "@/generated/client";
import { env } from "@/Env";
import { enviarEmailServico } from "@/lib/mail";
import { notificarUtilizadores } from "@/lib/notificar-admins";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-service";

/**
 * Comunicação única da plataforma: cada aviso sai, ao mesmo tempo, por
 *   - notificação na app (guardada e em tempo real, pelo socket);
 *   - push no telemóvel/browser (se a pessoa autorizou);
 *   - email (avisos de serviço: não dependem da subscrição de marketing).
 *
 * É sempre activo (não depende de flags de ambiente) e nunca lança: um canal que
 * falhe não impede os outros nem a operação que originou o aviso.
 */

export type Canal = "app" | "push" | "email";

export type Aviso = {
  titulo: string;
  conteudo: string;
  /** Caminho no site, ex.: "/mensagens". */
  link?: string;
  tipo?: "INFO" | "ERRO" | "ALERTA";
  entidade?: string;
  entidadeId?: string;
  /** Por omissão: todos. */
  canais?: Canal[];
  /** Personaliza o email (por omissão usa o título e o conteúdo). */
  email?: { assunto?: string; paragrafos?: string[]; botao?: string };
  /** Push que fica no ecrã até a pessoa reagir (ex.: mensagem nova). */
  destaque?: boolean;
};

const TODOS: Canal[] = ["app", "push", "email"];

export async function comunicar(userIds: string[], aviso: Aviso) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  const canais = aviso.canais ?? TODOS;

  const destinatarios = await prisma.user
    .findMany({
      where: { id: { in: ids }, estado_conta: "ACTIVA" },
      select: { id: true, nome: true, email: true, pushSubscription: true },
    })
    .catch((erro) => {
      console.error("[comunicar] falha ao ler destinatários", erro);
      return [];
    });
  if (destinatarios.length === 0) return;

  const tarefas: Promise<unknown>[] = [];

  if (canais.includes("app")) {
    tarefas.push(
      notificarUtilizadores(
        destinatarios.map((d) => d.id),
        {
          titulo: aviso.titulo,
          conteudo: aviso.conteudo,
          tipo: aviso.tipo ?? "INFO",
          link: aviso.link,
          entidade: aviso.entidade,
          entidadeId: aviso.entidadeId,
        }
      )
    );
  }

  if (canais.includes("push")) {
    for (const d of destinatarios) {
      tarefas.push(
        PushService.entregar(d.id, d.pushSubscription, {
          title: aviso.titulo,
          body: aviso.conteudo.slice(0, 180),
          url: aviso.link ?? "/",
          tag: aviso.entidade && aviso.entidadeId ? `${aviso.entidade}-${aviso.entidadeId}` : "aviso",
          destaque: aviso.destaque,
        })
      );
    }
  }

  if (canais.includes("email")) {
    for (const d of destinatarios) {
      const primeiroNome = d.nome.trim().split(/\s+/)[0];
      tarefas.push(
        enviarEmailServico(d.email, aviso.email?.assunto ?? aviso.titulo, {
          titulo: aviso.titulo,
          resumo: aviso.conteudo.slice(0, 140),
          saudacao: `Olá, ${primeiroNome}!`,
          paragrafos: aviso.email?.paragrafos ?? [aviso.conteudo],
          botao: aviso.link
            ? { texto: aviso.email?.botao ?? "Abrir na plataforma", href: `${env.FRONTEND_URL}${aviso.link}` }
            : undefined,
        })
      );
    }
  }

  const resultados = await Promise.allSettled(tarefas);
  for (const r of resultados) {
    if (r.status === "rejected") console.error("[comunicar] um canal falhou", r.reason);
  }
}

/** O mesmo aviso para todas as contas activas com estes cargos. */
export async function comunicarPorRole(roles: Role[], aviso: Aviso) {
  const contas = await prisma.user.findMany({
    where: { role: { in: roles }, estado_conta: "ACTIVA" },
    select: { id: true },
  });
  return comunicar(
    contas.map((c) => c.id),
    aviso
  );
}
