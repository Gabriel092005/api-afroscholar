import multer from 'multer'
import fs from 'fs'
import { UPLOAD_PATH } from '@/lib/upload';

// MESMO CAMINHO USADO PELO fastifyStatic E PELO lib/upload
const uploadDir = UPLOAD_PATH;

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 2. USE A VARIÁVEL DINÂMICA AQUI!
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    const uniqueName = `trem-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});


export const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
})