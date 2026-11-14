import crypto from "node:crypto";
import type { Role } from "@/generated/client";
import prisma from "@/lib/prisma";
import { io } from "@/server";

export type AvisoAdmin = {
  titulo: string;
  conteudo: string;
  tipo: "INFO" | "ERRO" | "ALERTA";
  link?: string;
  entidade?: string;
  entidadeId?: string;
};

/** Guarda o aviso para cada administrador e mostra-o a quem estiver com a app aberta. */
export function notificarAdmins(aviso: AvisoAdmin) {
  return notificarPorRole(["ADMIN"], aviso);
}

/** O mesmo aviso para todas as contas activas com um destes cargos. */
export async function notificarPorRole(roles: Role[], aviso: AvisoAdmin) {
  const destinatarios = await prisma.user.findMany({
    where: { role: { in: roles }, estado_conta: "ACTIVA" },
    select: { id: true },
  });
  return notificarUtilizadores(
    destinatarios.map(({ id }) => id),
    aviso
  );
}

/** Guarda o aviso para estes utilizadores e mostra-o a quem estiver com a app aberta. */
export async function notificarUtilizadores(userIds: string[], aviso: AvisoAdmin) {
  if (userIds.length === 0) return;
  const notificacoes = userIds.map((userId) => ({ id: crypto.randomUUID(), userId }));

  await prisma.notification.createMany({
    data: notificacoes.map((n) => ({
      id: n.id,
      userId: n.userId,
      titulo: aviso.titulo,
      content: aviso.conteudo,
      tipo: aviso.tipo,
      link: aviso.link,
      entidade: aviso.entidade,
      entidadeId: aviso.entidadeId,
    })),
  });

  for (const n of notificacoes) {
    io?.to(n.userId).emit("nova_notificacao", {
      id: n.id,
      titulo: aviso.titulo,
      conteudo: aviso.conteudo,
      tipo: aviso.tipo,
      link: aviso.link,
      visualizada: false,
      created_at: new Date().toISOString(),
    });
  }
}
