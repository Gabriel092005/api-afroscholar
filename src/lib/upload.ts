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

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});
