import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import prisma from "@/lib/prisma";

type Mentor = { id: string; nome: string; imagem: string | null; pais: string | null };

function chaveDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Rota pública: expõe apenas o nome, a fotografia e o país, nunca o e-mail ou o telefone.
async function listMentores(req: FastifyRequest, res: FastifyReply) {
  try {
    const [gestores, cursos] = await Promise.all([
      prisma.user.findMany({
        where: { role: "GESTOR", estado_conta: "ACTIVA" },
        select: { id: true, nome: true, image_path: true, paisMentoria: true },
      }),
      prisma.curso.findMany({
        where: { status: "PUBLICADO", mentorNome: { not: null } },
        select: { id: true, mentorNome: true, mentorAvatar: true },
      }),
    ]);

    const mentores = new Map<string, Mentor>();

    for (const gestor of gestores) {
      mentores.set(chaveDoNome(gestor.nome), {
        id: gestor.id,
        nome: gestor.nome.trim(),
        imagem: gestor.image_path,
        pais: gestor.paisMentoria,
      });
    }

    // O mesmo mentor pode estar em vários cursos e também ter conta de gestor.
    for (const curso of cursos) {
      const nome = curso.mentorNome?.trim();
      if (!nome) continue;

      const chave = chaveDoNome(nome);
      const existente = mentores.get(chave);
      if (!existente) {
        mentores.set(chave, { id: curso.id, nome, imagem: curso.mentorAvatar, pais: null });
      } else if (!existente.imagem && curso.mentorAvatar) {
        existente.imagem = curso.mentorAvatar;
      }
    }

    const data = [...mentores.values()].sort(
      (a, b) =>
        Number(Boolean(b.imagem)) - Number(Boolean(a.imagem)) ||
        a.nome.localeCompare(b.nome, "pt")
    );

    return res.header("Cache-Control", "public, max-age=300").send({ data });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar mentores." });
  }
}

export async function mentoresRoutes(fastify: FastifyInstance) {
  fastify.get("/mentores", listMentores);
}
