-- Pacotes de vários meses da mentoria de cada bolsa, e a duração escolhida em cada compra.
ALTER TABLE "Bolsa" ADD COLUMN "pacotesMentoria" JSONB;
ALTER TABLE "BolsaInscricao" ADD COLUMN "mesesMentoria" INTEGER;
