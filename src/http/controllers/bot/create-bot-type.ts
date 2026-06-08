// create-bot-schema.ts
import { BOT_STATE } from '@/generated/enums';
import { z } from 'zod';


export const createBotSchema = z.object({
  nome: z.string().min(3),
  funcao: z.string().min(1),
  descricao: z.string(),
  preco_mensal: z.preprocess((val) => Number(val), z.number()),
  custo_api_est: z.preprocess((val) => Number(val), z.number()),
  tags: z.preprocess((val) => (typeof val === 'string' ? JSON.parse(val) : val), z.array(z.string())),
  
  // O frontend deve enviar um JSON stringificado no FormData chamado 'videos'
  videos: z.preprocess(
    (val) => (typeof val === 'string' ? JSON.parse(val) : val),
    z.array(
      z.object({
        estado: z.nativeEnum(BOT_STATE),
        video_path: z.string(),
      })
    )
  ),
});