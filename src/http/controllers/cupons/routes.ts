import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { aplicarCupom, CupomError, normalizarCodigo } from "@/lib/cupons";
import { VALOR_MINIMO_MOMENU } from "@/lib/pagamentos-momenu";
import prisma from "@/lib/prisma";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

const TIPOS = ["CURSO", "BOLSA", "MENTORIA", "DOCUMENTO", "ANALISE"] as const;

const vazioParaNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), schema.nullable());

const cupomSchema = z
  .object({
    codigo: z
      .string()
      .transform(normalizarCodigo)
      .pipe(z.string().min(3, "O código precisa de pelo menos 3 caracteres.").max(40).regex(/^[A-Z0-9_-]+$/, "Use só letras, números, - e _.")),
    descricao: vazioParaNull(z.string().trim().max(300)).optional(),
    tipoDesconto: z.enum(["PERCENTAGEM", "VALOR_FIXO"]),
    valor: z.coerce.number().positive("O desconto tem de ser maior que zero."),
    tipos: z.array(z.enum(TIPOS)).default([]),
    itemId: vazioParaNull(z.string().trim().max(100)).optional(),
    limiteUsos: vazioParaNull(z.coerce.number().int().positive()).optional(),
    limitePorUsuario: z.coerce.number().int().positive().default(1),
    valorMinimo: vazioParaNull(z.coerce.number().nonnegative()).optional(),
    validoDesde: vazioParaNull(z.coerce.date()).optional(),
    validoAte: vazioParaNull(z.coerce.date()).optional(),
    ativo: z.boolean().default(true),
  })
  .refine((c) => c.tipoDesconto !== "PERCENTAGEM" || c.valor <= 100, {
    message: "A percentagem não pode passar de 100.",
  })
  .refine((c) => !c.validoDesde || !c.validoAte || c.validoDesde < c.validoAte, {
    message: "A data de fim tem de ser depois da data de início.",
  });

function erro(req: FastifyRequest, res: FastifyReply, e: unknown, mensagem: string) {
  if (e instanceof z.ZodError) return res.status(400).send({ message: e.errors.map((x) => x.message).join(", ") });
  req.log.error(e);
  return res.status(500).send({ message: mensagem });
}

const eCodigoRepetido = (e: unknown) => (e as { code?: string })?.code === "P2002";

export async function cuponsRoutes(fastify: FastifyInstance) {
  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  /**
   * Pré-visualização no ecrã de pagamento. O valor enviado serve só para mostrar o desconto:
   * na cobrança, o preço e o desconto voltam a ser calculados no servidor.
   */
  fastify.post("/cupons/validar", { onRequest: [verifyJWT] }, async (req, res) => {
    try {
      const body = z
        .object({
          codigo: z.string().trim().min(1, "Escreva o código do cupão."),
          tipo: z.enum(TIPOS),
          itemId: z.string().min(1),
          valor: z.coerce.number().nonnegative(),
        })
        .parse(req.body);

      const aplicacao = await aplicarCupom(body.codigo, {
        tipo: body.tipo,
        itemId: body.itemId,
        usuarioId: req.user.sub,
        valor: body.valor,
      });
      const abaixoDoMinimo = aplicacao.valorFinal > 0 && aplicacao.valorFinal < VALOR_MINIMO_MOMENU;
      if (abaixoDoMinimo) {
        return res.status(400).send({
          message: `Com este cupão o valor fica abaixo do mínimo aceite (${VALOR_MINIMO_MOMENU} Kz).`,
        });
      }

      return res.send({
        codigo: aplicacao.cupom.codigo,
        descricao: aplicacao.cupom.descricao,
        tipoDesconto: aplicacao.cupom.tipoDesconto,
        percentagem: aplicacao.cupom.tipoDesconto === "PERCENTAGEM" ? aplicacao.cupom.valor : null,
        valorOriginal: aplicacao.valorOriginal,
        desconto: aplicacao.desconto,
        valorFinal: aplicacao.valorFinal,
      });
    } catch (e) {
      if (e instanceof CupomError) return res.status(400).send({ message: e.message });
      return erro(req, res, e, "Erro ao validar o cupão.");
    }
  });

  fastify.get("/admin/cupons", apenasAdmin, async (req, res) => {
    try {
      const cupons = await prisma.cupom.findMany({ orderBy: { created_at: "desc" } });
      // Total descontado e faturado com cada cupão (só pagamentos confirmados).
      const somas = await prisma.pagamentoMomenu.groupBy({
        by: ["cupomId"],
        where: { cupomId: { in: cupons.map((c) => c.id) }, status: "PAGO" },
        _sum: { desconto: true, valor: true },
      });
      const porCupom = new Map(somas.map((s) => [s.cupomId, s._sum]));
      return res.send(
        cupons.map((c) => ({
          ...c,
          totalDescontado: porCupom.get(c.id)?.desconto ?? 0,
          totalFaturado: porCupom.get(c.id)?.valor ?? 0,
        }))
      );
    } catch (e) {
      return erro(req, res, e, "Erro ao carregar os cupões.");
    }
  });

  fastify.post("/admin/cupons", apenasAdmin, async (req, res) => {
    try {
      const dados = cupomSchema.parse(req.body);
      const cupom = await prisma.cupom.create({ data: { ...dados, criadoPorId: req.user.sub } });
      return res.status(201).send(cupom);
    } catch (e) {
      if (eCodigoRepetido(e)) return res.status(409).send({ message: "Já existe um cupão com este código." });
      return erro(req, res, e, "Erro ao criar o cupão.");
    }
  });

  fastify.put("/admin/cupons/:id", apenasAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const dados = cupomSchema.parse(req.body);
      const cupom = await prisma.cupom.update({ where: { id }, data: dados });
      return res.send(cupom);
    } catch (e) {
      if (eCodigoRepetido(e)) return res.status(409).send({ message: "Já existe um cupão com este código." });
      if ((e as { code?: string })?.code === "P2025") return res.status(404).send({ message: "Cupão não encontrado." });
      return erro(req, res, e, "Erro ao atualizar o cupão.");
    }
  });

  /** Apagar mantém o histórico dos pagamentos (ficam sem cupão associado). */
  fastify.delete("/admin/cupons/:id", apenasAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      await prisma.cupom.delete({ where: { id } });
      return res.status(204).send();
    } catch (e) {
      if ((e as { code?: string })?.code === "P2025") return res.status(404).send({ message: "Cupão não encontrado." });
      return erro(req, res, e, "Erro ao apagar o cupão.");
    }
  });
}
