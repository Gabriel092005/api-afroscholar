import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { io } from "@/server";

export type AvisoAdmin = {
  titulo: string;
  conteudo: string;
  tipo: "INFO" | "ERRO";
  link?: string;
  entidade?: string;
  entidadeId?: string;
};

/** Guarda o aviso para cada administrador e mostra-o a quem estiver com a app aberta. */
export async function notificarAdmins(aviso: AvisoAdmin) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const notificacoes = admins.map(({ id }) => ({ id: crypto.randomUUID(), userId: id }));

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
