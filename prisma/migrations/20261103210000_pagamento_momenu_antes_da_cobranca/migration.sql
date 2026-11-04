-- A cobrança passa a ser gravada antes de contactar a MoMenu, por isso o
-- transactionId pode ainda não existir.
ALTER TABLE "pagamentos_momenu" ALTER COLUMN "transactionId" DROP NOT NULL;
ALTER TABLE "pagamentos_momenu" ADD COLUMN "falhaMotivo" TEXT;
