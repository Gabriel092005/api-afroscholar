-- AlterTable
ALTER TABLE "NovidadeInscricao" ADD COLUMN     "comprovativoUrl" TEXT,
ADD COLUMN     "metodoPagamento" TEXT,
ADD COLUMN     "referenciaPagamento" TEXT,
ADD COLUMN     "valorPago" DOUBLE PRECISION;
