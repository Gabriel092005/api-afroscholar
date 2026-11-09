-- A análise de documentos passa a ser paga, com preços definidos pelo administrador.
ALTER TYPE "TipoPagamentoMomenu" ADD VALUE 'ANALISE';

CREATE TABLE "analise_tipos_documento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analise_tipos_documento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analise_pedidos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT,
    "referencia" TEXT,
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analise_pedidos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analise_pedidos_usuarioId_idx" ON "analise_pedidos"("usuarioId");

ALTER TABLE "AnaliseDocumento" ADD COLUMN "valor" DOUBLE PRECISION;
ALTER TABLE "AnaliseDocumento" ADD COLUMN "pedidoId" TEXT;

ALTER TABLE "analise_pedidos" ADD CONSTRAINT "analise_pedidos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnaliseDocumento" ADD CONSTRAINT "AnaliseDocumento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "analise_pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
