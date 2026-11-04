-- Quem já se inscreveu numa bolsa não pode voltar a inscrever-se.
ALTER TABLE "BolsaInscricao" ADD COLUMN "inscritoEm" TIMESTAMP(3);

UPDATE "BolsaInscricao"
SET "inscritoEm" = "updated_at"
WHERE "status" = 'APROVADA' AND "tipoInteresse" = 'INSCRICAO';
