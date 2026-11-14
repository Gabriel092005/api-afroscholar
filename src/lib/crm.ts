import type { EtapaLead, PagamentoMomenu } from "@/generated/client";
import { env } from "@/Env";
import { detalheDaVenda, gerarPdfContactos } from "@/lib/atendimento";
import { enviarEmailComAnexo } from "@/lib/mail";
import { comunicar, comunicarPorRole } from "@/lib/comunicar";
import { apresentarAtendente } from "@/lib/conversas";
import prisma from "@/lib/prisma";
import { enviarPdfWhatsapp, normalizarNumero, whatsappApiConfigurada } from "@/lib/whatsapp";

/**
 * CRM da equipa de atendimento. Cada cliente a acompanhar é um lead (um por cliente),
 * distribuído automaticamente pelo atendente com menos leads abertos. Eventos novos
 * (outro pagamento falhado, mentoria expirada) actualizam o mesmo lead e reabrem-no.
 */

export type OrigemLead = "PAGAMENTO_FALHADO" | "PAGAMENTO_PENDENTE" | "REGISTO" | "MENTORIA_EXPIRADA";

export const ROTULO_ORIGEM: Record<OrigemLead, string> = {
  PAGAMENTO_FALHADO: "Pagamento falhado",
  PAGAMENTO_PENDENTE: "Pagamento por concluir",
  REGISTO: "Novo registo",
  MENTORIA_EXPIRADA: "Mentoria expirada",
};

/**
 * A mensagem automática do atendente na conversa do cliente fica desligada até existir
 * o ecrã de Mensagens no frontend (o aviso ao cliente aponta para /mensagens).
 */
const APRESENTAR_ATENDENTE_NA_CONVERSA = false;

export const ETAPAS_ABERTAS: EtapaLead[] = ["NOVO", "CONTACTADO", "INTERESSADO"];

const DIA_MS = 24 * 60 * 60 * 1000;
const haDias = (dias: number) => new Date(Date.now() - dias * DIA_MS);
const formatarKz = (valor: number) => `${valor.toLocaleString("pt-PT")} Kz`;

/** O atendente activo com menos leads abertos (distribuição equilibrada). */
async function escolherAtendente(): Promise<string | null> {
  const atendentes = await prisma.user.findMany({
    where: { role: "ATENDIMENTO", estado_conta: "ACTIVA" },
    select: { id: true, _count: { select: { leadsAtribuidos: { where: { etapa: { in: ETAPAS_ABERTAS } } } } } },
  });
  if (atendentes.length === 0) return null;
  atendentes.sort((a, b) => a._count.leadsAtribuidos - b._count.leadsAtribuidos);
  return atendentes[0].id;
}

type EventoLead = {
  usuarioId: string;
  origem: OrigemLead;
  texto: string;
  produto?: string | null;
  caminho?: string | null;
  valor?: number | null;
  /** Avisar o atendente de um lead novo/reaberto (a venda cancelada manda o seu próprio alerta). */
  avisarAtendente?: boolean;
};

/**
 * Cria ou actualiza o lead do cliente. Um lead fechado (convertido/perdido) volta a NOVO,
 * porque há uma nova oportunidade. Devolve o lead e se o atendente deve ser avisado.
 */
export async function registarLead(evento: EventoLead) {
  const existente = await prisma.lead.findUnique({ where: { usuarioId: evento.usuarioId } });
  const atendenteId = existente?.atendenteId ?? (await escolherAtendente());
  const dados = {
    origem: evento.origem,
    produto: evento.produto ?? existente?.produto ?? null,
    caminho: evento.caminho ?? existente?.caminho ?? null,
    valorPotencial: evento.valor ?? existente?.valorPotencial ?? null,
    atendenteId,
    proximoContacto: new Date(),
  };

  const reaberto = !!existente && !ETAPAS_ABERTAS.includes(existente.etapa);
  const lead = existente
    ? await prisma.lead.update({
        where: { id: existente.id },
        data: { ...dados, ...(reaberto ? { etapa: "NOVO" as const } : {}) },
      })
    : await prisma.lead.create({ data: { usuarioId: evento.usuarioId, ...dados } });

  await prisma.leadInteracao.create({ data: { leadId: lead.id, tipo: "SISTEMA", texto: evento.texto } });

  // Nova oportunidade (lead novo ou reaberto): o atendente é avisado e apresenta-se ao cliente.
  if ((!existente || reaberto) && lead.atendenteId) {
    if (evento.avisarAtendente !== false) {
      const cliente = await prisma.user.findUnique({ where: { id: lead.usuarioId }, select: { nome: true, phone: true } });
      await comunicar([lead.atendenteId], {
        canais: ["app", "push"],
        titulo: `Novo potencial cliente: ${cliente?.nome ?? "cliente"}`,
        conteudo: `${ROTULO_ORIGEM[evento.origem]}${evento.produto ? ` — ${evento.produto}` : ""}. Telefone: ${cliente?.phone ?? "sem telefone"}.`,
        tipo: "ALERTA",
        link: `/crm?lead=${lead.id}`,
        entidade: "lead",
        entidadeId: lead.id,
        destaque: true,
      });
    }
    if (APRESENTAR_ATENDENTE_NA_CONVERSA) {
      await apresentarAtendente(lead.usuarioId, lead.atendenteId, motivoDoContacto(evento));
    }
  }
  return lead;
}

function motivoDoContacto(evento: EventoLead) {
  const produto = evento.produto ? evento.produto.replace(/^[^:]+:s*/, "") : "a sua inscrição";
  switch (evento.origem) {
    case "PAGAMENTO_FALHADO":
    case "PAGAMENTO_PENDENTE":
      return `Vi que o pagamento de ${produto} não foi concluído e posso ajudá-lo a terminar.`;
    case "MENTORIA_EXPIRADA":
      return "A sua mentoria terminou e posso ajudá-lo a renová-la para não perder o progresso.";
    default:
      return "Vi que se registou há pouco e posso ajudá-lo a escolher a bolsa e a mentoria certas para si.";
  }
}

/** O cliente pagou: o lead fica convertido (se havia um aberto). */
export async function marcarLeadConvertido(usuarioId: string, texto: string) {
  try {
    const lead = await prisma.lead.findUnique({ where: { usuarioId } });
    if (!lead || lead.etapa === "CONVERTIDO") return;
    await prisma.lead.update({ where: { id: lead.id }, data: { etapa: "CONVERTIDO", proximoContacto: null } });
    await prisma.leadInteracao.create({ data: { leadId: lead.id, tipo: "SISTEMA", texto } });
  } catch (erro) {
    console.error("[crm] falha ao marcar lead como convertido", erro);
  }
}

/**
 * Uma venda caiu (pagamento falhado, recusado ou expirado): cria/reabre o lead e avisa
 * o atendente responsável (ou toda a equipa, se ainda não houver atendentes). Nunca lança.
 */
export async function registarVendaCancelada(pagamento: PagamentoMomenu, motivo?: string) {
  if (!pagamento.usuarioId) return;
  try {
    const [cliente, detalhe] = await Promise.all([
      prisma.user.findUnique({ where: { id: pagamento.usuarioId }, select: { nome: true, phone: true } }),
      detalheDaVenda(pagamento),
    ]);
    const telefone = detalhe.telefone || cliente?.phone || "sem telefone";
    const lead = await registarLead({
      usuarioId: pagamento.usuarioId,
      origem: "PAGAMENTO_FALHADO",
      produto: detalhe.produto,
      caminho: detalhe.caminho,
      valor: pagamento.valor,
      texto: `Pagamento não concluído: ${detalhe.produto} — ${formatarKz(pagamento.valor)}.${motivo ? ` ${motivo}` : ""}`,
      avisarAtendente: false,
    });

    const aviso = {
      titulo: "Venda cancelada",
      conteudo: `${cliente?.nome ?? "Cliente"} (${telefone}) não concluiu ${detalhe.produto} — ${formatarKz(pagamento.valor)}. Ligue hoje.`,
      tipo: "ERRO" as const,
      link: `/crm?lead=${lead.id}`,
      entidade: "lead",
      entidadeId: lead.id,
    };
    const avisoCompleto = { ...aviso, destaque: true, email: { botao: "Abrir o lead no CRM" } };
    if (lead.atendenteId) await comunicar([lead.atendenteId], avisoCompleto);
    else await comunicarPorRole(["ATENDIMENTO", "ADMIN"], avisoCompleto);
  } catch (erro) {
    console.error("[crm] falha ao registar venda cancelada", erro);
  }
}

/**
 * Recolhe os leads do dia que não chegaram por eventos: pagamentos por concluir,
 * registos novos sem compra e mentorias que expiraram. Corre antes do resumo diário.
 */
export async function sincronizarLeads() {
  let criados = 0;

  // 1. Pagamentos por concluir nos últimos 3 dias, sem pagamento feito depois.
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
  const pendentes = await prisma.pagamentoMomenu.findMany({
    where: {
      usuarioId: { not: null },
      created_at: { gte: haDias(3) },
      OR: [{ status: "FALHADO" }, { status: "PENDENTE", created_at: { lte: umaHoraAtras } }],
    },
    orderBy: { created_at: "desc" },
  });
  const vistos = new Set<string>();
  for (const p of pendentes) {
    const usuarioId = p.usuarioId as string;
    if (vistos.has(usuarioId)) continue;
    vistos.add(usuarioId);
    const [pagouDepois, lead] = await Promise.all([
      prisma.pagamentoMomenu.count({ where: { usuarioId, status: "PAGO", created_at: { gte: p.created_at } } }),
      prisma.lead.findUnique({ where: { usuarioId }, select: { updated_at: true } }),
    ]);
    // Já tratado depois deste pagamento (ex.: pelo alerta da venda cancelada).
    if (pagouDepois > 0 || (lead && lead.updated_at >= p.created_at)) continue;
    const detalhe = await detalheDaVenda(p);
    await registarLead({
      usuarioId,
      origem: p.status === "PENDENTE" ? "PAGAMENTO_PENDENTE" : "PAGAMENTO_FALHADO",
      produto: detalhe.produto,
      caminho: detalhe.caminho,
      valor: p.valor,
      texto: `Pagamento por concluir: ${detalhe.produto} — ${formatarKz(p.valor)}.`,
    });
    criados++;
  }

  // 2. Registos das últimas 48h, com telefone e sem nenhuma compra: oportunidade de venda.
  const novos = await prisma.user.findMany({
    where: {
      role: "USUARIO",
      estado_conta: "ACTIVA",
      created_at: { gte: haDias(2), lte: new Date(Date.now() - 30 * 60 * 1000) },
      phone: { not: null },
      leadsComoCliente: { none: {} },
      pagamentosMomenu: { none: { status: "PAGO" } },
    },
    select: { id: true },
  });
  for (const u of novos) {
    await registarLead({ usuarioId: u.id, origem: "REGISTO", texto: "Novo registo na plataforma: apresentar a mentoria." });
    criados++;
  }

  // 3. Mentorias que expiraram há 1 a 7 dias e não foram renovadas.
  const expiradas = await prisma.mentoriaAcesso.findMany({
    where: { expiraEm: { gte: haDias(7), lte: haDias(1) } },
    select: {
      usuarioId: true,
      expiraEm: true,
      bolsaId: true,
      bolsa: { select: { titulo: true } },
      usuario: { select: { role: true } },
    },
  });
  for (const a of expiradas) {
    if (a.usuario.role !== "USUARIO") continue;
    const [ativa, lead] = await Promise.all([
      prisma.mentoriaAcesso.count({ where: { usuarioId: a.usuarioId, expiraEm: { gt: new Date() } } }),
      prisma.lead.findUnique({ where: { usuarioId: a.usuarioId }, select: { updated_at: true } }),
    ]);
    if (ativa > 0 || (lead && lead.updated_at >= a.expiraEm)) continue;
    await registarLead({
      usuarioId: a.usuarioId,
      origem: "MENTORIA_EXPIRADA",
      produto: `Renovação da mentoria: ${a.bolsa?.titulo ?? "bolsa"}`,
      caminho: a.bolsaId ? `/bolsas/${a.bolsaId}?servico=mentoria` : "/bolsas",
      texto: "A mentoria expirou e não foi renovada: propor a renovação.",
    });
    criados++;
  }

  return { criados };
}

/** Os leads de um atendente que pedem contacto hoje (novos ou com contacto agendado até hoje). */
export async function leadsParaHoje(atendenteId: string) {
  const fimDoDia = new Date();
  fimDoDia.setHours(23, 59, 59, 999);
  return prisma.lead.findMany({
    where: {
      atendenteId,
      etapa: { in: ETAPAS_ABERTAS },
      OR: [{ proximoContacto: { lte: fimDoDia } }, { proximoContacto: null, etapa: "NOVO" }],
    },
    orderBy: [{ proximoContacto: "asc" }],
    include: { usuario: { select: { nome: true, email: true, phone: true } } },
  });
}

/**
 * A mensagem diária de cada atendente: email com a lista de quem ligar hoje e uma
 * notificação na app. Devolve quantos atendentes receberam.
 */
export async function enviarResumoDiarioAtendentes() {
  const atendentes = await prisma.user.findMany({
    where: { role: "ATENDIMENTO", estado_conta: "ACTIVA" },
    select: { id: true, nome: true, email: true, phone: true },
  });

  let enviados = 0;
  let whatsapp = 0;
  for (const a of atendentes) {
    const leads = await leadsParaHoje(a.id);
    const primeiroNome = a.nome.trim().split(/\s+/)[0];

    // App e push; o email detalhado segue abaixo.
    await comunicar([a.id], {
      canais: ["app", "push"],
      titulo: "Os seus contactos de hoje",
      conteudo:
        leads.length > 0
          ? `Bom dia, ${primeiroNome}! Tem ${leads.length} cliente(s) para contactar hoje.`
          : `Bom dia, ${primeiroNome}! Não tem contactos agendados para hoje.`,
      tipo: "INFO",
      link: "/crm",
    });
    if (leads.length === 0) continue;

    const origem = (o: string) => ROTULO_ORIGEM[o as OrigemLead] ?? o;
    try {
      await enviarEmailComAnexo(
        [a.email],
        `Bom dia, ${primeiroNome}: ${leads.length} contacto(s) para hoje`,
        {
          titulo: "Os seus contactos de hoje",
          resumo: `${leads.length} cliente(s) à espera do seu contacto.`,
          saudacao: `Bom dia, ${primeiroNome}!`,
          paragrafos: [
            `Tem ${leads.length} cliente(s) para contactar hoje. Comece pelos pagamentos por concluir: são os mais fáceis de recuperar.`,
          ],
          lista: leads
            .slice(0, 30)
            .map(
              (l) =>
                `${l.usuario.nome} — ${l.usuario.phone ?? "sem telefone"} — ${origem(l.origem)}` +
                (l.produto ? ` — ${l.produto}` : "") +
                (l.valorPotencial ? ` (${formatarKz(l.valorPotencial)})` : "")
            ),
          botao: { texto: "Abrir o CRM", href: `${env.FRONTEND_URL}/crm` },
          nota: leads.length > 30 ? `E mais ${leads.length - 30} no CRM.` : undefined,
        },
        []
      );
      enviados++;
    } catch (erro) {
      // Sem SMTP, a notificação na app continua a chegar.
      console.error(`[crm] falha ao enviar o resumo diário a ${a.email}`, erro);
    }

    // Com a API do WhatsApp configurada, a lista do dia vai também em PDF para o telemóvel.
    const numero = normalizarNumero(a.phone);
    if (whatsappApiConfigurada() && numero) {
      try {
        const pdf = await gerarPdfContactos(
          leads.map((l) => ({
            nome: l.usuario.nome,
            email: l.usuario.email,
            telefone: l.usuario.phone ?? "",
            produtos: [l.produto ?? origem(l.origem)],
            valor: l.valorPotencial ?? 0,
            ultimaTentativa: l.updated_at,
            pagou: false,
          })),
          new Date(Date.now() - 7 * DIA_MS)
        );
        const r = await enviarPdfWhatsapp(
          [numero],
          pdf,
          `contactos-${new Date().toISOString().slice(0, 10)}.pdf`,
          `Bom dia, ${primeiroNome}! Tem ${leads.length} cliente(s) para contactar hoje. A lista está em anexo e no CRM.`
        );
        whatsapp += r.enviados;
      } catch (erro) {
        console.error(`[crm] falha ao enviar o resumo diário por WhatsApp a ${a.nome}`, erro);
      }
    }
  }
  return { atendentes: atendentes.length, emails: enviados, whatsapp };
}
