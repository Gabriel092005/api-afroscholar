import { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { VALOR_MINIMO_MOMENU } from "@/lib/pagamentos-momenu";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

const tipoSchema = z.object({
  nome: z.string().trim().min(2, "Indique o nome do documento.").max(120),
  descricao: z.string().trim().max(300).nullish(),
  preco: z.number().min(VALOR_MINIMO_MOMENU, `O preço mínimo é de ${VALOR_MINIMO_MOMENU} Kz.`),
  ativo: z.boolean().optional(),
});

export async function tiposAnaliseRoutes(fastify: FastifyInstance) {
  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  fastify.get("/analise-documento/tipos", { onRequest: [verifyJWT] }, async (_req, res) => {
    return res.send(
      await prisma.analiseTipoDocumento.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } })
    );
  });

  fastify.get("/admin/analise-documento/tipos", apenasAdmin, async (_req, res) => {
    return res.send(await prisma.analiseTipoDocumento.findMany({ orderBy: { nome: "asc" } }));
  });

  fastify.post("/admin/analise-documento/tipos", apenasAdmin, async (req, res) => {
    const body = tipoSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).send({ error: "Validation Error", message: body.error.issues[0]?.message });
    }
    return res.status(201).send(await prisma.analiseTipoDocumento.create({ data: body.data }));
  });

  fastify.patch("/admin/analise-documento/tipos/:id", apenasAdmin, async (req, res) => {
    const { id } = req.params as { id: string };
    const body = tipoSchema.partial().safeParse(req.body);
    if (!body.success) {
      return res.status(400).send({ error: "Validation Error", message: body.error.issues[0]?.message });
    }
    const { count } = await prisma.analiseTipoDocumento.updateMany({ where: { id }, data: body.data });
    if (count === 0) return res.status(404).send({ error: "Not Found", message: "Documento não encontrado." });
    return res.send({ id });
  });

  // Os pedidos guardam o nome e o preço, por isso apagar não altera o histórico.
  fastify.delete("/admin/analise-documento/tipos/:id", apenasAdmin, async (req, res) => {
    const { id } = req.params as { id: string };
    const { count } = await prisma.analiseTipoDocumento.deleteMany({ where: { id } });
    if (count === 0) return res.status(404).send({ error: "Not Found", message: "Documento não encontrado." });
    return res.status(204).send();
  });
}
