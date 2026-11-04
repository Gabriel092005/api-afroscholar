-- Campos de pagamento na mentoria e inscrições em mentorias
ALTER TABLE "mentorias" ADD COLUMN IF NOT EXISTS "preco" DOUBLE PRECISION NOT NULL DEFAULT 100;

ALTER TABLE "mentorias_inscricoes" ADD COLUMN IF NOT EXISTS "metodoPagamento" TEXT;
ALTER TABLE "mentorias_inscricoes" ADD COLUMN IF NOT EXISTS "referenciaPagamento" TEXT;
ALTER TABLE "mentorias_inscricoes" ADD COLUMN IF NOT EXISTS "comprovativoUrl" TEXT;
