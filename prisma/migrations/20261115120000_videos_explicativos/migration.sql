-- Vídeos explicativos publicados pelo admin, por público e por página.
CREATE TABLE "videos_explicativos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "url" TEXT NOT NULL,
    "publico" TEXT NOT NULL DEFAULT 'TODOS',
    "local" TEXT NOT NULL DEFAULT 'GERAL',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_explicativos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "videos_explicativos_publicado_local_idx" ON "videos_explicativos"("publicado", "local");
