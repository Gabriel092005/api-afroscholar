import { comunicar } from "@/lib/comunicar";
import prisma from "@/lib/prisma";
import { io } from "@/server";

/**
 * Canal permanente entre cada cliente e a equipa (atendimento, monitores e admin).
 * Uma conversa por cliente; cada mensagem avisa o outro lado na app, por push e,
 * na primeira mensagem por ler, por email (para não encher a caixa de correio).
 */

export const LINK_CLIENTE = "/mensagens";
export const linkEquipa = (conversaId: string) => `/equipa/mensagens?conversa=${conversaId}`;

const avisarEcra = (userIds: string[], conversaId: string) => {
  for (const id of new Set(userIds)) io?.to(id).emit("conversa_atualizada", { conversaId });
};

export async function obterOuCriarConversa(clienteId: string) {
  return prisma.conversa.upsert({
    where: { clienteId },
    update: {},
    create: { clienteId },
  });
}

/** Quem da equipa acompanha este cliente: o atendente do lead e, com mentoria activa, os monitores. */
async function equipaDoCliente(clienteId: string): Promise<string[]> {
  const [lead, mentorias] = await Promise.all([
    prisma.lead.findUnique({ where: { usuarioId: clienteId }, select: { atendenteId: true } }),
    prisma.mentoriaAcesso.findMany({
      where: { usuarioId: clienteId, expiraEm: { gt: new Date() } },
      select: { bolsa: { select: { criadoPor: { select: { id: true, role: true, estado_conta: true } } } } },
    }),
  ]);
  const mentoriaAtiva = mentorias.length;

  const ids = new Set<string>();
  if (lead?.atendenteId) {
    ids.add(lead.atendenteId);
  } else {
    const atendentes = await prisma.user.findMany({
      where: { role: "ATENDIMENTO", estado_conta: "ACTIVA" },
      select: { id: true },
    });
    atendentes.forEach((a) => ids.add(a.id));
  }
  if (mentoriaAtiva > 0) {
    const monitores = await prisma.user.findMany({
      where: { role: "MONITOR", estado_conta: "ACTIVA" },
      select: { id: true },
    });
    monitores.forEach((m) => ids.add(m.id));
    // O mentor (gestor que criou a bolsa) também acompanha as mensagens do seu mentorando.
    for (const m of mentorias) {
      const mentor = m.bolsa?.criadoPor;
      if (mentor && mentor.role === "GESTOR" && mentor.estado_conta === "ACTIVA") ids.add(mentor.id);
    }
  }
  // Sem ninguém na equipa, a mensagem não pode ficar sem resposta: vai para os admins.
  if (ids.size === 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", estado_conta: "ACTIVA" }, select: { id: true } });
    admins.forEach((a) => ids.add(a.id));
  }
  return [...ids];
}

const resumir = (texto: string) => (texto.length > 140 ? `${texto.slice(0, 137)}…` : texto);

export async function mensagemDoCliente(clienteId: string, texto: string) {
  const conversa = await obterOuCriarConversa(clienteId);
  const [mensagem] = await prisma.$transaction([
    prisma.mensagemConversa.create({
      data: { conversaId: conversa.id, autorId: clienteId, daEquipa: false, texto },
      include: { autor: { select: { id: true, nome: true } } },
    }),
    prisma.conversa.update({
      where: { id: conversa.id },
      data: { estado: "ABERTA", ultimaMensagemEm: new Date(), naoLidasEquipa: { increment: 1 } },
    }),
  ]);

  const [equipa, cliente] = await Promise.all([
    equipaDoCliente(clienteId),
    prisma.user.findUnique({ where: { id: clienteId }, select: { nome: true } }),
  ]);
  avisarEcra([...equipa, clienteId], conversa.id);
  await comunicar(equipa, {
    titulo: `💬 ${cliente?.nome ?? "Cliente"} enviou uma mensagem`,
    conteudo: resumir(texto),
    link: linkEquipa(conversa.id),
    entidade: "conversa",
    entidadeId: conversa.id,
    destaque: true,
    // Email só na primeira mensagem por ler: as seguintes já estão na mesma conversa.
    canais: conversa.naoLidasEquipa === 0 ? ["app", "push", "email"] : ["app", "push"],
    email: { botao: "Responder" },
  });
  return mensagem;
}

export async function mensagemDaEquipa(conversaId: string, autorId: string | null, texto: string) {
  const conversa = await prisma.conversa.findUnique({ where: { id: conversaId } });
  if (!conversa) throw new Error("Conversa não encontrada.");

  const [mensagem] = await prisma.$transaction([
    prisma.mensagemConversa.create({
      data: { conversaId, autorId, daEquipa: true, texto },
      include: { autor: { select: { id: true, nome: true } } },
    }),
    prisma.conversa.update({
      where: { id: conversaId },
      data: { ultimaMensagemEm: new Date(), naoLidasCliente: { increment: 1 }, naoLidasEquipa: 0 },
    }),
  ]);

  const autor = mensagem.autor?.nome?.split(" ")[0] ?? "A equipa";
  avisarEcra([conversa.clienteId, ...(autorId ? [autorId] : [])], conversaId);
  await comunicar([conversa.clienteId], {
    titulo: `💬 ${autor} respondeu-lhe`,
    conteudo: resumir(texto),
    link: LINK_CLIENTE,
    entidade: "conversa",
    entidadeId: conversaId,
    destaque: true,
    canais: conversa.naoLidasCliente === 0 ? ["app", "push", "email"] : ["app", "push"],
    email: {
      assunto: `${autor} da equipa Afroscholars enviou-lhe uma mensagem`,
      paragrafos: [`${autor} escreveu:`, `"${texto}"`, "Pode responder directamente na plataforma."],
      botao: "Responder",
    },
  });
  return mensagem;
}

/**
 * O primeiro contacto da equipa: uma mensagem do atendente na conversa do cliente,
 * para ele saber quem o acompanha e poder responder a qualquer momento.
 */
export async function apresentarAtendente(clienteId: string, atendenteId: string, motivo: string) {
  try {
    const [atendente, cliente] = await Promise.all([
      prisma.user.findUnique({ where: { id: atendenteId }, select: { nome: true } }),
      prisma.user.findUnique({ where: { id: clienteId }, select: { nome: true } }),
    ]);
    if (!atendente || !cliente) return;
    const conversa = await obterOuCriarConversa(clienteId);
    const nomeCliente = cliente.nome.trim().split(/\s+/)[0];
    const nomeAtendente = atendente.nome.trim().split(/\s+/)[0];
    await mensagemDaEquipa(
      conversa.id,
      atendenteId,
      `Olá, ${nomeCliente}! Sou a/o ${nomeAtendente}, da equipa Afroscholars, e vou acompanhá-lo. ${motivo} Se tiver alguma dúvida, responda aqui: estou disponível.`
    );
  } catch (erro) {
    console.error("[conversas] falha ao apresentar o atendente", erro);
  }
}

export async function marcarLidaPeloCliente(clienteId: string) {
  await prisma.conversa.updateMany({ where: { clienteId }, data: { naoLidasCliente: 0 } });
}

export async function marcarLidaPelaEquipa(conversaId: string) {
  await prisma.conversa.updateMany({ where: { id: conversaId }, data: { naoLidasEquipa: 0 } });
}
