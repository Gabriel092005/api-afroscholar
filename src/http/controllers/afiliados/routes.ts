import crypto from "node:crypto";
import { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { calcularSaldo, percentualGlobal, SLUG_PERCENTUAL_GLOBAL, type TipoAfiliado } from "@/lib/afiliados";
import { notificar } from "@/lib/pagamentos-momenu";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

const tipoSchema = z.enum(["BOLSA", "DOCUMENTO", "CURSO"]);
const percentualSchema = z.number().min(0).max(100);

const linkSchema = z.object({ tipo: tipoSchema, itemId: z.string().min(1) });
const saqueSchema = z.object({
  valor: z.number().positive("Indique um valor válido."),
  iban: z.string().trim().min(15, "Indique um IBAN válido.").max(40, "Indique um IBAN válido."),
  titular: z.string().trim().min(3, "Indique o nome do titular.").max(120),
});
const configSchema = z.object({ percentual: percentualSchema });
const produtoSchema = z.object({ percentual: percentualSchema.nullable() });
const processarSaqueSchema = z.object({
  status: z.enum(["PAGO", "REJEITADO"]),
  observacao: z.string().trim().max(300).optional(),
});

function validar<T>(schema: z.ZodType<T>, dados: unknown, res: FastifyReply): T | null {
  const resultado = schema.safeParse(dados);
  if (resultado.success) return resultado.data;
  res.status(400).send({ error: "Validation Error", message: resultado.error.issues[0]?.message });
  return null;
}

const destinoDoProduto = (tipo: string, itemId: string) => {
  if (tipo === "BOLSA") return `/bolsas/${itemId}`;
  return tipo === "CURSO" ? `/cursos/${itemId}` : "/documentos";
};

/** Os documentos ligados a uma bolsa só são visíveis a quem tem a mentoria: não se divulgam. */
const ondeDocumentoDivulgavel = { status: "PUBLICADO", preco: { gt: 0 }, bolsaId: null } as const;
/** Os cursos de uma bolsa chegam com a inscrição nela: vende-se a bolsa. */
const ondeCursoDivulgavel = { status: "PUBLICADO", preco: { gt: 0 }, bolsaId: null } as const;

async function produtoExiste(tipo: TipoAfiliado, itemId: string) {
  if (tipo === "BOLSA") {
    return (await prisma.bolsa.count({ where: { id: itemId, status: "PUBLICADA" } })) > 0;
  }
  if (tipo === "CURSO") {
    return (await prisma.curso.count({ where: { id: itemId, ...ondeCursoDivulgavel } })) > 0;
  }
  return (await prisma.documento.count({ where: { id: itemId, ...ondeDocumentoDivulgavel } })) > 0;
}

export async function afiliadosRoutes(fastify: FastifyInstance) {
  // Público: quem abre o link pode ainda não ter conta.
  fastify.get("/afiliados/r/:codigo", async (req, res) => {
    const { codigo } = req.params as { codigo: string };
    const link = await prisma.afiliadoLink.findUnique({ where: { codigo } });
    if (!link) return res.status(404).send({ error: "Not Found", message: "Link não encontrado." });

    await prisma.afiliadoLink.update({ where: { id: link.id }, data: { cliques: { increment: 1 } } });
    return res.send({
      codigo: link.codigo,
      tipo: link.tipo,
      itemId: link.itemId,
      destino: destinoDoProduto(link.tipo, link.itemId),
    });
  });

  fastify.get("/afiliados/produtos", { onRequest: [verifyJWT] }, async (req, res) => {
    const [global, bolsas, documentos, cursos, links] = await Promise.all([
      percentualGlobal(),
      prisma.bolsa.findMany({
        where: { status: "PUBLICADA" },
        select: { id: true, titulo: true, comissaoAfiliado: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.documento.findMany({
        where: ondeDocumentoDivulgavel,
        select: { id: true, titulo: true, comissaoAfiliado: true, preco: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.curso.findMany({
        where: ondeCursoDivulgavel,
        select: { id: true, titulo: true, comissaoAfiliado: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.afiliadoLink.findMany({ where: { usuarioId: req.user.sub } }),
    ]);

    const linkDe = (tipo: TipoAfiliado, id: string) =>
      links.find((l) => l.tipo === tipo && l.itemId === id);
    const montar = (tipo: TipoAfiliado) => (p: { id: string; titulo: string; comissaoAfiliado: number | null }) => {
      const link = linkDe(tipo, p.id);
      return {
        tipo,
        id: p.id,
        titulo: p.titulo,
        percentual: p.comissaoAfiliado ?? global,
        codigo: link?.codigo ?? null,
        cliques: link?.cliques ?? 0,
      };
    };

    return res.send([
      ...bolsas.map(montar("BOLSA")),
      ...cursos.map(montar("CURSO")),
      ...documentos.map(montar("DOCUMENTO")),
    ]);
  });

  fastify.post("/afiliados/links", { onRequest: [verifyJWT] }, async (req, res) => {
    const body = validar(linkSchema, req.body, res);
    if (!body) return;
    if (!(await produtoExiste(body.tipo, body.itemId))) {
      return res.status(404).send({ error: "Not Found", message: "Produto não disponível para afiliados." });
    }

    const link = await prisma.afiliadoLink.upsert({
      where: { usuarioId_tipo_itemId: { usuarioId: req.user.sub, ...body } },
      update: {},
      create: {
        usuarioId: req.user.sub,
        ...body,
        codigo: crypto.randomBytes(5).toString("hex").toUpperCase(),
      },
    });
    return res.status(201).send({ codigo: link.codigo });
  });

  fastify.get("/afiliados/resumo", { onRequest: [verifyJWT] }, async (req, res) => {
    const usuarioId = req.user.sub;
    const [saldo, comissoes, saques, cliques] = await Promise.all([
      calcularSaldo(usuarioId),
      prisma.afiliadoComissao.findMany({
        where: { afiliadoId: usuarioId },
        include: { link: { select: { tipo: true, itemId: true } } },
        orderBy: { created_at: "desc" },
        take: 50,
      }),
      prisma.afiliadoSaque.findMany({
        where: { usuarioId },
        orderBy: { created_at: "desc" },
        take: 50,
      }),
      prisma.afiliadoLink.aggregate({ where: { usuarioId }, _sum: { cliques: true } }),
    ]);

    const idsDe = (tipo: string) => comissoes.filter((c) => c.link.tipo === tipo).map((c) => c.link.itemId);
    const [bolsas, documentos, cursos] = await Promise.all([
      prisma.bolsa.findMany({ where: { id: { in: idsDe("BOLSA") } }, select: { id: true, titulo: true } }),
      prisma.documento.findMany({ where: { id: { in: idsDe("DOCUMENTO") } }, select: { id: true, titulo: true } }),
      prisma.curso.findMany({ where: { id: { in: idsDe("CURSO") } }, select: { id: true, titulo: true } }),
    ]);
    const titulos = new Map([...bolsas, ...documentos, ...cursos].map((p) => [p.id, p.titulo]));

    return res.send({
      saldo,
      cliques: cliques._sum.cliques ?? 0,
      comissoes: comissoes.map((c) => ({
        id: c.id,
        produto: titulos.get(c.link.itemId) ?? "Produto removido",
        valorVenda: c.valorVenda,
        percentual: c.percentual,
        valor: c.valor,
        created_at: c.created_at,
      })),
      saques,
    });
  });

  fastify.post("/afiliados/saques", { onRequest: [verifyJWT] }, async (req, res) => {
    const body = validar(saqueSchema, req.body, res);
    if (!body) return;
    const usuarioId = req.user.sub;

    const saque = await prisma.$transaction(async (tx) => {
      // Trava o utilizador: dois pedidos simultâneos não podem gastar o mesmo saldo.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${usuarioId} FOR UPDATE`;
      const { disponivel } = await calcularSaldo(usuarioId, tx);
      if (body.valor > disponivel) return null;
      return tx.afiliadoSaque.create({ data: { usuarioId, ...body } });
    });

    if (!saque) {
      return res.status(400).send({ error: "Bad Request", message: "O valor pedido é superior ao saldo disponível." });
    }

    const [solicitante, admins] = await Promise.all([
      prisma.user.findUnique({ where: { id: usuarioId }, select: { nome: true } }),
      prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
    ]);
    await Promise.all(
      admins.map((admin) =>
        notificar({
          usuarioId: admin.id,
          titulo: "Novo pedido de saque",
          conteudo: `${solicitante?.nome ?? "Um afiliado"} pediu um saque de ${saque.valor.toLocaleString("pt-PT")} Kz.`,
          tipo: "PAGAMENTO",
          link: "/admin/afiliados",
        })
      )
    );

    return res.status(201).send(saque);
  });

  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  fastify.get("/admin/afiliados", apenasAdmin, async (_req, res) => {
    const [global, saques, bolsas, documentos, cursos] = await Promise.all([
      percentualGlobal(),
      prisma.afiliadoSaque.findMany({
        include: { usuario: { select: { nome: true, email: true } } },
        orderBy: [{ status: "asc" }, { created_at: "desc" }],
        take: 200,
      }),
      prisma.bolsa.findMany({
        where: { status: "PUBLICADA" },
        select: { id: true, titulo: true, comissaoAfiliado: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.documento.findMany({
        where: ondeDocumentoDivulgavel,
        select: { id: true, titulo: true, comissaoAfiliado: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.curso.findMany({
        where: ondeCursoDivulgavel,
        select: { id: true, titulo: true, comissaoAfiliado: true },
        orderBy: { created_at: "desc" },
      }),
    ]);

    return res.send({
      percentualGlobal: global,
      saques,
      produtos: [
        ...bolsas.map((p) => ({ ...p, tipo: "BOLSA" as const })),
        ...cursos.map((p) => ({ ...p, tipo: "CURSO" as const })),
        ...documentos.map((p) => ({ ...p, tipo: "DOCUMENTO" as const })),
      ],
    });
  });

  fastify.put("/admin/afiliados/config", apenasAdmin, async (req, res) => {
    const body = validar(configSchema, req.body, res);
    if (!body) return;
    const value = String(body.percentual);
    await prisma.setting.upsert({
      where: { slug: SLUG_PERCENTUAL_GLOBAL },
      update: { value },
      create: { slug: SLUG_PERCENTUAL_GLOBAL, value },
    });
    return res.send({ percentual: body.percentual });
  });

  fastify.patch("/admin/afiliados/produtos/:tipo/:id", apenasAdmin, async (req, res) => {
    const { tipo, id } = req.params as { tipo: string; id: string };
    const tipoValido = validar(tipoSchema, tipo, res);
    if (!tipoValido) return;
    const body = validar(produtoSchema, req.body, res);
    if (!body) return;

    const data = { comissaoAfiliado: body.percentual };
    const { count } =
      tipoValido === "BOLSA"
        ? await prisma.bolsa.updateMany({ where: { id }, data })
        : tipoValido === "CURSO"
          ? await prisma.curso.updateMany({ where: { id }, data })
          : await prisma.documento.updateMany({ where: { id }, data });
    if (count === 0) return res.status(404).send({ error: "Not Found", message: "Produto não encontrado." });
    return res.send({ id, percentual: body.percentual });
  });

  fastify.patch("/admin/afiliados/saques/:id", apenasAdmin, async (req, res) => {
    const { id } = req.params as { id: string };
    const body = validar(processarSaqueSchema, req.body, res);
    if (!body) return;

    // Só sai de PENDENTE uma vez, mesmo com dois administradores ao mesmo tempo.
    const { count } = await prisma.afiliadoSaque.updateMany({
      where: { id, status: "PENDENTE" },
      data: { status: body.status, observacao: body.observacao, processadoEm: new Date() },
    });
    if (count === 0) {
      return res.status(409).send({ error: "Conflict", message: "Este pedido já foi processado." });
    }

    const saque = await prisma.afiliadoSaque.findUniqueOrThrow({ where: { id } });
    const valor = `${saque.valor.toLocaleString("pt-PT")} Kz`;
    await notificar(
      body.status === "PAGO"
        ? {
            usuarioId: saque.usuarioId,
            titulo: "Saque pago ✅",
            conteudo: `Transferimos ${valor} para o seu IBAN.`,
            tipo: "SUCESSO",
            link: "/afiliados",
          }
        : {
            usuarioId: saque.usuarioId,
            titulo: "Saque rejeitado",
            conteudo: `O seu pedido de ${valor} foi rejeitado e o valor voltou ao saldo.${body.observacao ? ` ${body.observacao}` : ""}`,
            tipo: "ERRO",
            link: "/afiliados",
          }
    );
    return res.send(saque);
  });
}
