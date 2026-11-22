-- Área social: acesso de mentoria concedido pelo admin, com permissões por área.
CREATE TABLE "membros_sociais" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "todasBolsas" BOOLEAN NOT NULL DEFAULT true,
    "bolsaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documentos" BOOLEAN NOT NULL DEFAULT true,
    "cursos" BOOLEAN NOT NULL DEFAULT true,
    "comunidades" BOOLEAN NOT NULL DEFAULT true,
    "aulas" BOOLEAN NOT NULL DEFAULT true,
    "ia" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "expiraEm" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membros_sociais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "membros_sociais_usuarioId_key" ON "membros_sociais"("usuarioId");

ALTER TABLE "membros_sociais" ADD CONSTRAINT "membros_sociais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cupões de desconto.
CREATE TYPE "TipoDescontoCupom" AS ENUM ('PERCENTAGEM', 'VALOR_FIXO');

CREATE TABLE "cupons" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipoDesconto" "TipoDescontoCupom" NOT NULL DEFAULT 'PERCENTAGEM',
    "valor" DOUBLE PRECISION NOT NULL,
    "tipos" "TipoPagamentoMomenu"[] DEFAULT ARRAY[]::"TipoPagamentoMomenu"[],
    "itemId" TEXT,
    "limiteUsos" INTEGER,
    "limitePorUsuario" INTEGER NOT NULL DEFAULT 1,
    "valorMinimo" DOUBLE PRECISION,
    "validoDesde" TIMESTAMP(3),
    "validoAte" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "criadoPorId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cupons_codigo_key" ON "cupons"("codigo");

ALTER TABLE "pagamentos_momenu" ADD COLUMN "cupomId" TEXT,
ADD COLUMN "valorOriginal" DOUBLE PRECISION,
ADD COLUMN "desconto" DOUBLE PRECISION;

CREATE INDEX "pagamentos_momenu_cupomId_idx" ON "pagamentos_momenu"("cupomId");

ALTER TABLE "pagamentos_momenu" ADD CONSTRAINT "pagamentos_momenu_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "cupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
