-- Cobranças da MoMenu (Multicaixa Express e Referência)
CREATE TYPE "TipoPagamentoMomenu" AS ENUM ('CURSO', 'BOLSA', 'MENTORIA');

CREATE TYPE "PagamentoMomenuStatus" AS ENUM ('PENDENTE', 'PAGO', 'FALHADO');

CREATE TABLE "pagamentos_momenu" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "operationId" TEXT,
    "tipo" "TipoPagamentoMomenu" NOT NULL,
    "alvoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT NOT NULL,
    "status" "PagamentoMomenuStatus" NOT NULL DEFAULT 'PENDENTE',
    "referenceNumber" TEXT,
    "entity" TEXT,
    "dueDate" TIMESTAMP(3),
    "invoiceUrl" TEXT,
    "ultimaVerificacao" TIMESTAMP(3),
    "pagoEm" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_momenu_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pagamentos_momenu_transactionId_key" ON "pagamentos_momenu"("transactionId");

CREATE INDEX "pagamentos_momenu_tipo_alvoId_idx" ON "pagamentos_momenu"("tipo", "alvoId");

CREATE INDEX "pagamentos_momenu_status_ultimaVerificacao_idx" ON "pagamentos_momenu"("status", "ultimaVerificacao");

ALTER TABLE "pagamentos_momenu" ADD CONSTRAINT "pagamentos_momenu_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Alterações que estavam no schema sem migração. Os pagamentos dependem delas:
-- sem estas colunas, as consultas a Curso e BolsaInscricao falham.
-- São idempotentes porque algumas bases já as têm (aplicadas com db push).
DO $$ BEGIN
    CREATE TYPE "DocumentoStatus" AS ENUM ('RASCUNHO', 'PUBLICADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Bolsa" ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;
ALTER TABLE "BolsaInscricao" ADD COLUMN IF NOT EXISTS "dataAgendada" TIMESTAMP(3);
ALTER TABLE "BolsaInscricao" ADD COLUMN IF NOT EXISTS "duracaoMinutos" INTEGER DEFAULT 60;
ALTER TABLE "Curso" ADD COLUMN IF NOT EXISTS "bolsaId" TEXT;
ALTER TABLE "Curso" ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;

CREATE TABLE IF NOT EXISTS "documentos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "status" "DocumentoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criadoPorId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Bolsa" DROP CONSTRAINT IF EXISTS "Bolsa_criadoPorId_fkey";
ALTER TABLE "Bolsa" ADD CONSTRAINT "Bolsa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Curso" DROP CONSTRAINT IF EXISTS "Curso_bolsaId_fkey";
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Curso" DROP CONSTRAINT IF EXISTS "Curso_criadoPorId_fkey";
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documentos" DROP CONSTRAINT IF EXISTS "documentos_criadoPorId_fkey";
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
