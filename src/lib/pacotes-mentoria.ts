import { z } from "zod";

const MESES_BASE = 1;

const pacoteSchema = z.object({
  meses: z.number().int().min(2, "Um pacote tem de ter pelo menos 2 meses.").max(36, "Um pacote pode ter no máximo 36 meses."),
  multiplicador: z.number().gt(1, "O multiplicador tem de ser maior que 1.").max(36, "O multiplicador é demasiado alto."),
});

const pacotesSchema = z.array(pacoteSchema).max(6, "Pode criar no máximo 6 pacotes.").superRefine((pacotes, ctx) => {
  if (new Set(pacotes.map((p) => p.meses)).size !== pacotes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Não repita a duração dos pacotes." });
  }
  // Uma referência pendente é reutilizada pelo valor: dois pacotes com o mesmo preço confundiam-se.
  if (new Set(pacotes.map((p) => p.multiplicador)).size !== pacotes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cada pacote tem de ter um multiplicador diferente." });
  }
});

export type PacoteMentoria = z.infer<typeof pacoteSchema>;

/** Os formulários das bolsas são multipart: os pacotes chegam como JSON em texto. */
export const pacotesFormularioSchema = z
  .string()
  .transform((texto, ctx) => {
    try {
      return JSON.parse(texto) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pacotes de mentoria inválidos." });
      return z.NEVER;
    }
  })
  .pipe(pacotesSchema);

/** Durações à venda. Uma mentoria gratuita fica só com o mês base. */
export function opcoesMentoria(precoBase: number, pacotes: unknown): { meses: number; valor: number }[] {
  const base = { meses: MESES_BASE, valor: precoBase };
  if (precoBase <= 0) return [base];

  const lidos = pacotesSchema.safeParse(pacotes);
  if (!lidos.success) return [base];

  return [
    base,
    ...lidos.data
      .map((p) => ({ meses: p.meses, valor: Math.round(precoBase * p.multiplicador) }))
      .sort((a, b) => a.meses - b.meses),
  ];
}

export function duracaoEmTexto(meses: number): string {
  return meses === 1 ? "1 mês" : `${meses} meses`;
}
