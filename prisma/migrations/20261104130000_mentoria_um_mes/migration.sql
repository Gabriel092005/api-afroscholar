-- A mentoria passa a durar um mês. Quem já a tinha conta o mês a partir de agora.
ALTER TABLE "mentoria_acessos" ADD COLUMN "expiraEm" TIMESTAMP(3);
ALTER TABLE "mentoria_acessos" ADD COLUMN "encerradoEm" TIMESTAMP(3);

UPDATE "mentoria_acessos" SET "expiraEm" = CURRENT_TIMESTAMP + INTERVAL '1 month';

ALTER TABLE "mentoria_acessos" ALTER COLUMN "expiraEm" SET NOT NULL;

CREATE INDEX "mentoria_acessos_expiraEm_idx" ON "mentoria_acessos"("expiraEm");
