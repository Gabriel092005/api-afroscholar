import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Prisma } from "@/generated/client";
import { ETAPAS_ABERTAS, enviarResumoDiarioAtendentes, sincronizarLeads } from "@/lib/crm";
import prisma from "@/lib/prisma";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

const ETAPAS = ["NOVO", "CONTACTADO", "INTERESSADO", "CONVERTIDO", "PERDIDO"] as const;
const TIPOS_INTERACAO = ["NOTA", "CHAMADA", "WHATSAPP", "EMAIL"] as const;

const ROTULO_ETAPA: Record<(typeof ETAPAS)[number], string> = {
  NOVO: "Novo",
  CONTACTADO: "Contactado",
  INTERESSADO: "Interessado",
  CONVERTIDO: "Convertido",
  PERDIDO: "Perdido",
};

const incluirLead = {
  usuario: { select: { id: true, nome: true, email: true, phone: true, image_path: true } },
  atendente: { select: { id: true, nome: true } },
} satisfies Prisma.LeadInclude;

/** Quem pede, e se pode ver todos os leads (admin) ou só os seus (atendente). */
async function quemPede(req: FastifyRequest) {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, role: true } });
  return { id: req.user.sub, admin: user?.role === "ADMIN" };
}

function fimDoDia() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function erro(req: FastifyRequest, res: FastifyReply, e: unknown, mensagem: string) {
  if (e instanceof z.ZodError) return res.status(400).send({ message: e.errors.map((x) => x.message).join(", ") });
  req.log.error(e);
  return res.status(500).send({ message: mensagem });
}

export async function crmRoutes(fastify: FastifyInstance) {
  const equipa = { onRequest: [verifyJWT, verifyUserRole("ADMIN", "ATENDIMENTO")] };
  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  /** Lista do pipeline. escopo=hoje mostra só o que pede contacto hoje. */
  fastify.get("/crm/leads", equipa, async (req, res) => {
    try {
      const q = z
        .object({
          etapa: z.enum(ETAPAS).optional(),
          escopo: z.enum(["hoje", "abertos", "todos"]).default("abertos"),
          busca: z.string().trim().max(100).optional(),
          atendenteId: z.string().uuid().optional(),
        })
        .parse(req.query);
      const eu = await quemPede(req);

      const where: Prisma.LeadWhereInput = {
        ...(eu.admin ? (q.atendenteId ? { atendenteId: q.atendenteId } : {}) : { atendenteId: eu.id }),
        ...(q.etapa ? { etapa: q.etapa } : q.escopo === "todos" ? {} : { etapa: { in: ETAPAS_ABERTAS } }),
        ...(q.escopo === "hoje"
          ? { OR: [{ proximoContacto: { lte: fimDoDia() } }, { proximoContacto: null, etapa: "NOVO" }] }
          : {}),
        ...(q.busca
          ? {
              usuario: {
                OR: [
                  { nome: { contains: q.busca, mode: "insensitive" } },
                  { email: { contains: q.busca, mode: "insensitive" } },
                  { phone: { contains: q.busca } },
                ],
              },
            }
          : {}),
      };

      const leads = await prisma.lead.findMany({
        where,
        include: incluirLead,
        orderBy: [{ proximoContacto: { sort: "asc", nulls: "first" } }, { updated_at: "desc" }],
        take: 200,
      });
      return res.send(leads);
    } catch (e) {
      return erro(req, res, e, "Erro ao listar os leads.");
    }
  });

  /** Totais por etapa e quantos pedem contacto hoje. */
  fastify.get("/crm/resumo", equipa, async (req, res) => {
    try {
      const eu = await quemPede(req);
      const dono = eu.admin ? {} : { atendenteId: eu.id };
      const [porEtapa, hoje, convertidos30] = await Promise.all([
        prisma.lead.groupBy({ by: ["etapa"], where: dono, _count: { _all: true } }),
        prisma.lead.count({
          where: {
            ...dono,
            etapa: { in: ETAPAS_ABERTAS },
            OR: [{ proximoContacto: { lte: fimDoDia() } }, { proximoContacto: null, etapa: "NOVO" }],
          },
        }),
        prisma.lead.count({
          where: { ...dono, etapa: "CONVERTIDO", updated_at: { gte: new Date(Date.now() - 30 * 86400000) } },
        }),
      ]);
      return res.send({
        admin: eu.admin,
        hoje,
        convertidos30,
        porEtapa: Object.fromEntries(porEtapa.map((e) => [e.etapa, e._count._all])),
      });
    } catch (e) {
      return erro(req, res, e, "Erro ao carregar o resumo do CRM.");
    }
  });

  /** Ficha do lead: contacto, histórico e últimos pagamentos do cliente. */
  fastify.get("/crm/leads/:id", equipa, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const eu = await quemPede(req);
      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          ...incluirLead,
          interacoes: {
            orderBy: { created_at: "desc" },
            take: 100,
            include: { autor: { select: { id: true, nome: true } } },
          },
        },
      });
      if (!lead || (!eu.admin && lead.atendenteId !== eu.id)) {
        return res.status(404).send({ message: "Lead não encontrado." });
      }
      const pagamentos = await prisma.pagamentoMomenu.findMany({
        where: { usuarioId: lead.usuarioId },
        orderBy: { created_at: "desc" },
        take: 10,
        select: { id: true, tipo: true, valor: true, status: true, metodo: true, created_at: true },
      });
      return res.send({ ...lead, pagamentos });
    } catch (e) {
      return erro(req, res, e, "Erro ao carregar o lead.");
    }
  });

  /** Mudar a etapa, agendar o próximo contacto ou (admin) reatribuir. */
  fastify.patch("/crm/leads/:id", equipa, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          etapa: z.enum(ETAPAS).optional(),
          proximoContacto: z.coerce.date().nullable().optional(),
          atendenteId: z.string().uuid().nullable().optional(),
        })
        .parse(req.body);
      const eu = await quemPede(req);
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead || (!eu.admin && lead.atendenteId !== eu.id)) {
        return res.status(404).send({ message: "Lead não encontrado." });
      }
      if (body.atendenteId !== undefined && !eu.admin) {
        return res.status(403).send({ message: "Só o administrador pode reatribuir leads." });
      }

      const historico: string[] = [];
      if (body.etapa && body.etapa !== lead.etapa) {
        historico.push(`Etapa: ${ROTULO_ETAPA[lead.etapa]} → ${ROTULO_ETAPA[body.etapa]}`);
      }
      if (body.atendenteId !== undefined && body.atendenteId !== lead.atendenteId) {
        const novo = body.atendenteId
          ? await prisma.user.findFirst({
              where: { id: body.atendenteId, role: "ATENDIMENTO" },
              select: { nome: true },
            })
          : null;
        if (body.atendenteId && !novo) return res.status(400).send({ message: "Esse utilizador não é atendente." });
        historico.push(novo ? `Atribuído a ${novo.nome}` : "Sem atendente atribuído");
      }
      if (body.proximoContacto !== undefined) {
        historico.push(
          body.proximoContacto
            ? `Próximo contacto: ${body.proximoContacto.toLocaleString("pt-PT", { timeZone: "Africa/Luanda" })}`
            : "Próximo contacto removido"
        );
      }

      const fechado = body.etapa === "CONVERTIDO" || body.etapa === "PERDIDO";
      const atualizado = await prisma.lead.update({
        where: { id },
        data: {
          ...(body.etapa ? { etapa: body.etapa } : {}),
          ...(body.atendenteId !== undefined ? { atendenteId: body.atendenteId } : {}),
          ...(body.proximoContacto !== undefined ? { proximoContacto: body.proximoContacto } : {}),
          ...(fechado ? { proximoContacto: null } : {}),
        },
        include: incluirLead,
      });
      if (historico.length > 0) {
        await prisma.leadInteracao.create({
          data: { leadId: id, autorId: eu.id, tipo: "ETAPA", texto: historico.join(" · ") },
        });
      }
      return res.send(atualizado);
    } catch (e) {
      return erro(req, res, e, "Erro ao actualizar o lead.");
    }
  });

  /** Registar uma chamada, mensagem ou nota (e, opcionalmente, o próximo contacto). */
  fastify.post("/crm/leads/:id/interacoes", equipa, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z
        .object({
          tipo: z.enum(TIPOS_INTERACAO),
          texto: z.string().trim().min(1, "Escreva o resumo do contacto.").max(2000),
          proximoContacto: z.coerce.date().nullable().optional(),
        })
        .parse(req.body);
      const eu = await quemPede(req);
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead || (!eu.admin && lead.atendenteId !== eu.id)) {
        return res.status(404).send({ message: "Lead não encontrado." });
      }

      const contacto = body.tipo !== "NOTA";
      const [interacao] = await prisma.$transaction([
        prisma.leadInteracao.create({
          data: { leadId: id, autorId: eu.id, tipo: body.tipo, texto: body.texto },
          include: { autor: { select: { id: true, nome: true } } },
        }),
        prisma.lead.update({
          where: { id },
          data: {
            ...(contacto ? { ultimoContacto: new Date() } : {}),
            // O primeiro contacto real tira o lead de "Novo".
            ...(contacto && lead.etapa === "NOVO" ? { etapa: "CONTACTADO" as const } : {}),
            ...(body.proximoContacto !== undefined ? { proximoContacto: body.proximoContacto } : {}),
          },
        }),
      ]);
      return res.status(201).send(interacao);
    } catch (e) {
      return erro(req, res, e, "Erro ao registar o contacto.");
    }
  });

  /** Para o admin escolher a quem atribuir. */
  fastify.get("/crm/atendentes", apenasAdmin, async (_req, res) => {
    const atendentes = await prisma.user.findMany({
      where: { role: "ATENDIMENTO" },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        phone: true,
        estado_conta: true,
        _count: { select: { leadsAtribuidos: { where: { etapa: { in: ETAPAS_ABERTAS } } } } },
      },
    });
    return res.send(
      atendentes.map(({ _count, ...a }) => ({ ...a, leadsAbertos: _count.leadsAtribuidos }))
    );
  });

  /** Corre já a recolha de leads (normalmente corre todas as manhãs). */
  fastify.post("/crm/sincronizar", apenasAdmin, async (req, res) => {
    try {
      return res.send(await sincronizarLeads());
    } catch (e) {
      return erro(req, res, e, "Erro ao sincronizar os leads.");
    }
  });

  /** Envia já a mensagem diária aos atendentes. */
  fastify.post("/crm/resumo-diario", apenasAdmin, async (req, res) => {
    try {
      return res.send(await enviarResumoDiarioAtendentes());
    } catch (e) {
      return erro(req, res, e, "Erro ao enviar o resumo diário.");
    }
  });
}
