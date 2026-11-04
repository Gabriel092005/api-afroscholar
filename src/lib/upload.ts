import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const isProduction = process.env.NODE_ENV === "production";

export const UPLOAD_PATH =
  process.env.UPLOAD_DIR ||
  (isProduction ? "/root/api_afroscholars/uploads" : path.resolve(process.cwd(), "uploads"));

if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_PATH),
  filename: (req, file, cb) => {
    const uniqueName = `trem-${Date.now()}-${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// A pasta de uploads é pública e serve o mesmo domínio da aplicação: um .html ou .svg
// carregado aqui correria como página do site e poderia ler a sessão de quem o abrisse.
const EXTENSOES_PERMITIDAS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".heic",
  ".mp4", ".webm", ".mov",
  ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".opus",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".zip",
]);

/** Áudio gravado no navegador pode vir sem extensão: nesse caso é servido como ficheiro binário. */
export const filtroDeFicheiros: multer.Options["fileFilter"] = (_req, file, cb) => {
  const extensao = path.extname(file.originalname).toLowerCase();
  if (!extensao || EXTENSOES_PERMITIDAS.has(extensao)) return cb(null, true);
  cb(new Error(`Formato de ficheiro não permitido: ${extensao}`));
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: filtroDeFicheiros,
});
