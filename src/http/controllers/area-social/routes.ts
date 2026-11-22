import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  bolsasComunidadesSociais,
  juntarMembroSocialAsComunidades,
  retirarMembroSocialDasComunidades,
} from "@/lib/mentoria-acesso";
import { notificar } from "@/lib/pagamentos-momenu";
import prisma from "@/lib/prisma";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

const permissoesSchema = z.object({
  todasBolsas: z.boolean().default(true),
  bolsaIds: z.array(z.string().uuid()).max(500).default([]),
  documentos: z.boolean().default(true),
  cursos: z.boolean().default(true),
  comunidades: z.boolean().default(true),
  aulas: z.boolean().default(true),
  ia: z.boolean().default(true),
  ativo: z.boolean().default(true),
  expiraEm: z.coerce.date().nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});

const criarSchema = permissoesSchema.extend({ usuarioId: z.string().uuid() });

const RECURSOS = ["documentos", "cursos", "comunidades", "aulas", "ia"] as const;

function erro(req: FastifyRequest, res: FastifyReply, e: unknown, mensagem: string) {
  if (e instanceof z.ZodError) return res.status(400).send({ message: e.errors.map((x) => x.message).join(", ") });
  req.log.error(e);
  return res.status(500).send({ message: mensagem });
}

function validar(dados: z.infer<typeof permissoesSchema>): string | null {
  if (!dados.todasBolsas && dados.bolsaIds.length === 0) return "Escolha pelo menos uma bolsa ou marque todas.";
  if (!RECURSOS.some((r) => dados[r])) return "Escolha pelo menos uma permissão.";
  if (dados.expiraEm && dados.expiraEm <= new Date()) return "A data de fim tem de ser futura.";
  return null;
}

const incluirUsuario = {
  usuario: { select: { id: true, nome: true, email: true, image_path: true, role: true } },
} as const;

/** Área social: o admin dá a quem escolher o acesso de quem pagou a mentoria, com permissões. */
export async function areaSocialRoutes(fastify: FastifyInstance) {
  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  fastify.get("/admin/area-social", apenasAdmin, async (req, res) => {
    try {
      const membros = await prisma.membroSocial.findMany({
        include: incluirUsuario,
        orderBy: { created_at: "desc" },
      });
      return res.send(membros);
    } catch (e) {
      return erro(req, res, e, "Erro ao carregar a área social.");
    }
  });

  fastify.post("/admin/area-social", apenasAdmin, async (req, res) => {
    try {
      const { usuarioId, ...dados } = criarSchema.parse(req.body);
      const invalido = validar(dados);
      if (invalido) return res.status(400).send({ message: invalido });

      const usuario = await prisma.user.findUnique({ where: { id: usuarioId }, select: { id: true } });
      if (!usuario) return res.status(404).send({ message: "Utilizador não encontrado." });
      if (await prisma.membroSocial.findUnique({ where: { usuarioId } })) {
        return res.status(409).send({ message: "Esta pessoa já está na área social. Edite as permissões dela." });
      }

      const membro = await prisma.membroSocial.create({
        data: { usuarioId, ...dados, expiraEm: dados.expiraEm ?? null, criadoPorId: req.user.sub },
        include: incluirUsuario,
      });
      await juntarMembroSocialAsComunidades(usuarioId);

      if (membro.ativo) {
        await notificar({
          usuarioId,
          titulo: "Acesso concedido 🎉",
          conteudo: "Foi adicionado à área social da plataforma. Já tem acesso aos conteúdos da mentoria que lhe foram atribuídos.",
          tipo: "SUCESSO",
          link: "/bolsas",
        });
      }
      return res.status(201).send(membro);
    } catch (e) {
      return erro(req, res, e, "Erro ao adicionar à área social.");
    }
  });

  fastify.put("/admin/area-social/:id", apenasAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const dados = permissoesSchema.parse(req.body);
      const invalido = validar(dados);
      if (invalido) return res.status(400).send({ message: invalido });

      const atual = await prisma.membroSocial.findUnique({ where: { id } });
      if (!atual) return res.status(404).send({ message: "Membro não encontrado." });

      // Comparar antes e depois, para sair só das comunidades que deixou de ter.
      const antes = await bolsasComunidadesSociais(atual.usuarioId);
      const membro = await prisma.membroSocial.update({
        where: { id },
        data: { ...dados, expiraEm: dados.expiraEm ?? null },
        include: incluirUsuario,
      });
      await retirarMembroSocialDasComunidades(atual.usuarioId, antes);
      await juntarMembroSocialAsComunidades(atual.usuarioId);

      return res.send(membro);
    } catch (e) {
      return erro(req, res, e, "Erro ao atualizar as permissões.");
    }
  });

  fastify.delete("/admin/area-social/:id", apenasAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const atual = await prisma.membroSocial.findUnique({ where: { id } });
      if (!atual) return res.status(404).send({ message: "Membro não encontrado." });

      const antes = await bolsasComunidadesSociais(atual.usuarioId);
      await prisma.membroSocial.delete({ where: { id } });
      await retirarMembroSocialDasComunidades(atual.usuarioId, antes);

      await notificar({
        usuarioId: atual.usuarioId,
        titulo: "Acesso removido",
        conteudo: "O seu acesso pela área social terminou. Fale connosco se tiver dúvidas.",
        tipo: "INFO",
        link: "/bolsas",
      });
      return res.status(204).send();
    } catch (e) {
      return erro(req, res, e, "Erro ao remover da área social.");
    }
  });
}
