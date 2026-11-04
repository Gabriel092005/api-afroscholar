-- Documentos à venda: preço no documento e registo de quem o comprou.
ALTER TYPE "TipoPagamentoMomenu" ADD VALUE 'DOCUMENTO';

ALTER TABLE "documentos" ADD COLUMN "preco" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "documento_compras" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT,
    "referencia" TEXT,
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "comprovativo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_compras_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documento_compras_documentoId_usuarioId_key" ON "documento_compras"("documentoId", "usuarioId");

ALTER TABLE "documento_compras" ADD CONSTRAINT "documento_compras_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documento_compras" ADD CONSTRAINT "documento_compras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
