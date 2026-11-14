import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Role } from "@/generated/client";
import { comunicar } from "@/lib/comunicar";
import prisma from "@/lib/prisma";
import { UPLOAD_PATH } from "@/lib/upload";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

const PUBLICOS = ["TODOS", "USUARIO", "MENTORANDO", "ATENDIMENTO", "MONITOR", "GESTOR"] as const;
const LOCAIS = ["GERAL", "MENTORIA", "PAGAMENTOS", "CRM"] as const;

/** Aceita youtube.com/watch?v=, youtu.be/, /shorts/ e /embed/; devolve o id do vídeo. */
export function idDoYoutube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Vídeo carregado do computador: guardado em /uploads e referenciado na própria url. */
const EXTENSOES_VIDEO = new Set([".mp4", ".webm", ".mov", ".m4v"]);
export const eFicheiroLocal = (url: string) =>
  /^\/uploads\/[\w.-]+$/.test(url) && EXTENSOES_VIDEO.has(path.extname(url).toLowerCase());

const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_PATH),
    filename: (_req, file, cb) =>
      cb(null, `video-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (EXTENSOES_VIDEO.has(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error("Formato não suportado: use MP4, WEBM ou MOV."));
  },
});

function apagarFicheiro(url: string) {
  if (!eFicheiroLocal(url)) return;
  fs.promises.unlink(path.join(UPLOAD_PATH, path.basename(url))).catch(() => undefined);
}

const videoSchema = z.object({
  titulo: z.string().trim().min(3, "O título é obrigatório.").max(120),
  descricao: z.string().trim().max(500).nullable().optional(),
  url: z
    .string()
    .trim()
    .refine((u) => idDoYoutube(u) !== null || eFicheiroLocal(u), "Cole um link do YouTube ou carregue um vídeo."),
  publico: z.enum(PUBLICOS).default("TODOS"),
  local: z.enum(LOCAIS).default("GERAL"),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  publicado: z.boolean().default(true),
});

function erro(req: FastifyRequest, res: FastifyReply, e: unknown, mensagem: string) {
  if (e instanceof z.ZodError) return res.status(400).send({ message: e.errors.map((x) => x.message).join(", ") });
  req.log.error(e);
  return res.status(500).send({ message: mensagem });
}

/** Os públicos que um utilizador pode ver. O admin vê tudo. */
async function publicosDe(usuarioId: string): Promise<string[] | null> {
  const user = await prisma.user.findUnique({ where: { id: usuarioId }, select: { role: true } });
  if (!user) return ["TODOS"];
  if (user.role === "ADMIN") return null;
  const publicos = ["TODOS", user.role];
  // Mentorando: quem tem a mentoria activa (o monitor também vê o que os mentorandos vêem).
  if (user.role === "MONITOR") publicos.push("MENTORANDO");
  else if ((await prisma.mentoriaAcesso.count({ where: { usuarioId, expiraEm: { gt: new Date() } } })) > 0) {
    publicos.push("MENTORANDO");
  }
  return publicos;
}

/** Quem recebe o aviso de um vídeo novo, conforme o público. */
async function destinatarios(publico: string): Promise<string[]> {
  if (publico === "MENTORANDO") {
    const ativos = await prisma.mentoriaAcesso.findMany({
      where: { expiraEm: { gt: new Date() } },
      select: { usuarioId: true },
      distinct: ["usuarioId"],
    });
    return ativos.map((a) => a.usuarioId);
  }
  const contas = await prisma.user.findMany({
    where: { estado_conta: "ACTIVA", ...(publico === "TODOS" ? {} : { role: publico as Role }) },
    select: { id: true },
  });
  return contas.map((c) => c.id);
}

export async function videosRoutes(fastify: FastifyInstance) {
  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  /** Os vídeos publicados para quem pede, opcionalmente só os de uma página. */
  fastify.get("/videos", { onRequest: [verifyJWT] }, async (req, res) => {
    try {
      const { local } = z.object({ local: z.enum(LOCAIS).optional() }).parse(req.query);
      const publicos = await publicosDe(req.user.sub);
      const videos = await prisma.videoExplicativo.findMany({
        where: {
          publicado: true,
          ...(local ? { local: { in: [local, "GERAL"] } } : {}),
          ...(publicos ? { publico: { in: publicos } } : {}),
        },
        orderBy: [{ ordem: "asc" }, { created_at: "desc" }],
      });
      return res.send(videos.map((v) => ({ ...v, youtubeId: idDoYoutube(v.url) })));
    } catch (e) {
      return erro(req, res, e, "Erro ao carregar os vídeos.");
    }
  });

  /** Carregar um vídeo do computador (até 500 MB). Devolve a url para guardar no vídeo. */
  fastify.post("/admin/videos/upload", apenasAdmin, async (req, res) => {
    try {
      await new Promise<void>((resolve, reject) => {
        uploadVideo.single("file")(req.raw as never, res.raw as never, (err: unknown) => (err ? reject(err) : resolve()));
      });
      const ficheiro = (req.raw as unknown as { file?: { filename: string } }).file;
      if (!ficheiro) return res.status(400).send({ message: "Escolha um ficheiro de vídeo." });
      return res.status(201).send({ url: `/uploads/${ficheiro.filename}` });
    } catch (e) {
      const mensagem =
        (e as { code?: string }).code === "LIMIT_FILE_SIZE"
          ? "O vídeo tem mais de 500 MB. Comprima-o ou publique-o no YouTube."
          : e instanceof Error
            ? e.message
            : "Não foi possível carregar o vídeo.";
      return res.status(400).send({ message: mensagem });
    }
  });

  fastify.get("/admin/videos", apenasAdmin, async (_req, res) => {
    const videos = await prisma.videoExplicativo.findMany({ orderBy: [{ ordem: "asc" }, { created_at: "desc" }] });
    return res.send(videos.map((v) => ({ ...v, youtubeId: idDoYoutube(v.url) })));
  });

  fastify.post("/admin/videos", apenasAdmin, async (req, res) => {
    try {
      const body = videoSchema.extend({ notificar: z.boolean().default(false) }).parse(req.body);
      const { notificar, ...dados } = body;
      const video = await prisma.videoExplicativo.create({ data: { ...dados, criadoPorId: req.user.sub } });

      // Aviso opcional (app e push) a quem o vídeo se destina. Não atrasa a resposta.
      if (notificar && video.publicado) {
        void destinatarios(video.publico).then((ids) =>
          comunicar(ids, {
            canais: ["app", "push"],
            titulo: `🎬 Novo vídeo: ${video.titulo}`,
            conteudo: video.descricao || "Veja o novo vídeo explicativo na plataforma.",
            link: "/como-funciona",
            entidade: "video",
            entidadeId: video.id,
          })
        );
      }
      return res.status(201).send({ ...video, youtubeId: idDoYoutube(video.url) });
    } catch (e) {
      return erro(req, res, e, "Erro ao publicar o vídeo.");
    }
  });

  fastify.put("/admin/videos/:id", apenasAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const dados = videoSchema.partial().parse(req.body);
      const anterior = await prisma.videoExplicativo.findUnique({ where: { id }, select: { url: true } });
      const video = await prisma.videoExplicativo.update({ where: { id }, data: dados });
      // Trocou o ficheiro (ou passou para YouTube): o antigo deixa de ocupar espaço.
      if (anterior && dados.url && dados.url !== anterior.url) apagarFicheiro(anterior.url);
      return res.send({ ...video, youtubeId: idDoYoutube(video.url) });
    } catch (e) {
      return erro(req, res, e, "Erro ao actualizar o vídeo.");
    }
  });

  fastify.delete("/admin/videos/:id", apenasAdmin, async (req, res) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const video = await prisma.videoExplicativo.delete({ where: { id } });
      apagarFicheiro(video.url);
      return res.status(204).send();
    } catch (e) {
      return erro(req, res, e, "Erro ao apagar o vídeo.");
    }
  });
}
