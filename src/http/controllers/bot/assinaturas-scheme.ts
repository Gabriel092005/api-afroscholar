

// src/schemas/assinatura-schema.ts
import { z } from 'zod';

export const approvalSchema = z.object({
  assinaturaId: z.string().uuid("ID de assinatura inválido"),
});

export const rejectSchema = z.object({
  assinaturaId: z.string().uuid("ID de assinatura inválido"),
});