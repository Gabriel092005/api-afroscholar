-- Afiliados: links por produto, comissões por venda paga e pedidos de saque.
CREATE TYPE "SaqueAfiliadoStatus" AS ENUM ('PENDENTE', 'PAGO', 'REJEITADO');

ALTER TABLE "Bolsa" ADD COLUMN "comissaoAfiliado" DOUBLE PRECISION;
ALTER TABLE "documentos" ADD COLUMN "comissaoAfiliado" DOUBLE PRECISION;
ALTER TABLE "pagamentos_momenu" ADD COLUMN "afiliadoLinkId" TEXT;

CREATE TABLE "afiliado_links" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoPagamentoMomenu" NOT NULL,
    "itemId" TEXT NOT NULL,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "afiliado_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "afiliado_comissoes" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "afiliadoId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "valorVenda" DOUBLE PRECISION NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "afiliado_comissoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "afiliado_saques" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "iban" TEXT NOT NULL,
    "titular" TEXT NOT NULL,
    "status" "SaqueAfiliadoStatus" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "processadoEm" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "afiliado_saques_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "afiliado_links_codigo_key" ON "afiliado_links"("codigo");
CREATE UNIQUE INDEX "afiliado_links_usuarioId_tipo_itemId_key" ON "afiliado_links"("usuarioId", "tipo", "itemId");
CREATE UNIQUE INDEX "afiliado_comissoes_pagamentoId_key" ON "afiliado_comissoes"("pagamentoId");
CREATE INDEX "afiliado_comissoes_afiliadoId_idx" ON "afiliado_comissoes"("afiliadoId");
CREATE INDEX "afiliado_saques_usuarioId_idx" ON "afiliado_saques"("usuarioId");
CREATE INDEX "afiliado_saques_status_idx" ON "afiliado_saques"("status");

ALTER TABLE "pagamentos_momenu" ADD CONSTRAINT "pagamentos_momenu_afiliadoLinkId_fkey" FOREIGN KEY ("afiliadoLinkId") REFERENCES "afiliado_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "afiliado_links" ADD CONSTRAINT "afiliado_links_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "afiliado_comissoes" ADD CONSTRAINT "afiliado_comissoes_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "pagamentos_momenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "afiliado_comissoes" ADD CONSTRAINT "afiliado_comissoes_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "afiliado_comissoes" ADD CONSTRAINT "afiliado_comissoes_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "afiliado_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "afiliado_saques" ADD CONSTRAINT "afiliado_saques_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
