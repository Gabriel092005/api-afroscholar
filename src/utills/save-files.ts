// src/utils/save-file.ts (ou src/utills/save-file.ts)
import fs from 'fs/promises';
import path from 'path';

export async function saveFile(
  file: Express.Multer.File | Buffer | string,
  destinationDir: string,
  filename?: string
): Promise<string> {
  try {
    // Cria o diretório se não existir
    await fs.mkdir(destinationDir, { recursive: true });
    
    let finalFilename: string;
    let buffer: Buffer;
    
    if (typeof file === 'string') {
      // Se for string base64
      buffer = Buffer.from(file, 'base64');
      finalFilename = filename || `${Date.now()}.jpg`;
    } else if ('buffer' in file) {
      // Se for Multer file
      buffer = file.buffer;
      finalFilename = filename || 'ss';
    } else {
      // Se já for Buffer
      buffer = file;
      finalFilename = filename || `${Date.now()}.bin`;
    }
    
    // Adiciona timestamp ao nome do arquivo para evitar conflitos
    const timestamp = Date.now();
    const ext = path.extname(finalFilename);
    const nameWithoutExt = path.basename(finalFilename, ext);
    const uniqueFilename = `${nameWithoutExt}-${timestamp}${ext}`;
    
    const filePath = path.join(destinationDir, uniqueFilename);
    
    // Salva o arquivo
    await fs.writeFile(filePath, buffer);
    
    return uniqueFilename;
  } catch (error) {
    console.error('Erro ao salvar arquivo:', error);
    throw new Error('Falha ao salvar arquivo');
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
  }
}