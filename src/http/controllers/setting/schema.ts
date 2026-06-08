import { z } from 'zod';

export const updateExpressMessageSchema = z.object({
  mensagem: z.string().min(1, "A mensagem não pode estar vazia").max(300, "Máximo de 300 caracteres"),
});