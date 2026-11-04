import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import multer from "multer";
import prisma from "@/lib/prisma";
import { bolsasComMentoria } from "@/lib/mentoria-acesso";
import { VALOR_MINIMO_MOMENU } from "@/lib/pagamentos-momenu";
import { UPLOAD_PATH } from "@/lib/upload";

// Fora da pasta /uploads, que é pública: quem sabe o link de um ficheiro aí abre-o sem pagar.
export const DOCUMENTOS_PATH =
  process.env.DOCUMENTOS_DIR || path.resolve(UPLOAD_PATH, "..", "documentos-privados");

if (!fs.existsSync(DOCUMENTOS_PATH)) {
  fs.mkdirSync(DOCUMENTOS_PATH, { recursive: true });
}

const PREFIXO_PRIVADO = "privado:";
const LIMITE_MB = 10;
const EXTENSOES = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"]);

export class ErroDocumento extends Error {}

const receber = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DOCUMENTOS_PATH),
    filename: (_req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: LIMITE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (EXTENSOES.has(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new ErroDocumento("Formato não suportado. Use PDF, DOC, DOCX ou imagem."));
  },
});

/** Lê o formulário e guarda o ficheiro na pasta privada. */
export async function receberDocumento(req: FastifyRequest, res: FastifyReply) {
  await new Promise<void>((resolve, reject) => {
    receber.single("arquivo")(req.raw as any, res.raw as any, (erro: unknown) => {
      if (erro instanceof multer.MulterError && erro.code === "LIMIT_FILE_SIZE") {
        return reject(new ErroDocumento(`O ficheiro tem mais de ${LIMITE_MB} MB.`));
      }
      if (erro) return reject(erro);
      resolve();
    });
  });
  const raw = req.raw as any;
  return {
    file: raw.file as Express.Multer.File | undefined,
    body: raw.body || req.body || {},
  };
}

export const urlPrivada = (ficheiro: string) => `${PREFIXO_PRIVADO}${ficheiro}`;
export const eLinkExterno = (fileUrl: string) => /^https?:\/\//i.test(fileUrl);

/** Caminho no disco, ou null se o ficheiro estiver fora do servidor. */
export function caminhoDoFicheiro(fileUrl: string): string | null {
  if (fileUrl.startsWith(PREFIXO_PRIVADO)) {
    return path.join(DOCUMENTOS_PATH, path.basename(fileUrl.slice(PREFIXO_PRIVADO.length)));
  }
  if (fileUrl.startsWith("/uploads/")) return path.join(UPLOAD_PATH, path.basename(fileUrl));
  return null;
}

/** Um documento antigo que passa a ter preço sai da pasta pública, onde qualquer um o abriria. */
export async function protegerFicheiro(fileUrl: string): Promise<string> {
  if (!fileUrl.startsWith("/uploads/")) return fileUrl;
  const nome = path.basename(fileUrl);
  await fs.promises.copyFile(path.join(UPLOAD_PATH, nome), path.join(DOCUMENTOS_PATH, nome));
  await fs.promises.unlink(path.join(UPLOAD_PATH, nome));
  return urlPrivada(nome);
}

export async function apagarFicheiroPrivado(fileUrl: string) {
  if (!fileUrl.startsWith(PREFIXO_PRIVADO)) return;
  await fs.promises.rm(caminhoDoFicheiro(fileUrl)!, { force: true });
}

/** As regras de preço. Devolve a mensagem de erro, ou null se estiver tudo certo. */
export function erroNoPreco(documento: { preco: number; bolsaId?: string | null; fileUrl: string }) {
  if (documento.preco <= 0) return null;
  if (documento.preco < VALOR_MINIMO_MOMENU) {
    return `O preço mínimo é de ${VALOR_MINIMO_MOMENU} Kz. Para oferecer o documento, deixe o preço em branco.`;
  }
  if (documento.bolsaId) {
    return "Um documento de bolsa já está incluído na mentoria: não pode ter preço.";
  }
  if (eLinkExterno(documento.fileUrl)) {
    return "Um documento à venda tem de ter o ficheiro carregado: um link externo não fica protegido.";
  }
  return null;
}

export type Leitor = {
  id: string | null;
  role: string | null;
  comprados: Set<string>;
  bolsas: string[];
};

/** Quem está a pedir. Sem sessão válida, só vê o que é gratuito. */
export async function lerLeitor(req: FastifyRequest): Promise<Leitor> {
  const id = await req
    .jwtVerify<{ sub: string }>()
    .then((token) => token.sub)
    .catch(() => null);
  if (!id) return { id: null, role: null, comprados: new Set(), bolsas: [] };

  const [user, compras, bolsas] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { role: true } }),
    prisma.documentoCompra.findMany({
      where: { usuarioId: id, status: "APROVADO" },
      select: { documentoId: true },
    }),
    bolsasComMentoria(id),
  ]);
  return {
    id,
    role: user?.role ?? null,
    comprados: new Set(compras.map((c) => c.documentoId)),
    bolsas,
  };
}

export function podeAbrirDocumento(
  documento: { id: string; status: string; preco: number; bolsaId: string | null; criadoPorId: string },
  leitor: Leitor
): boolean {
  if (leitor.role === "ADMIN" || documento.criadoPorId === leitor.id) return true;
  // Quem pagou continua a ter o ficheiro, mesmo que o documento volte a rascunho.
  if (leitor.comprados.has(documento.id)) return true;
  if (documento.status !== "PUBLICADO") return false;
  if (documento.bolsaId) {
    return leitor.role === "GESTOR" || leitor.bolsas.includes(documento.bolsaId);
  }
  return documento.preco <= 0;
}
