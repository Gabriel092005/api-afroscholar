-- CreateTable
CREATE TABLE "Novidade" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "sobre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_path" TEXT,
    "image_url" TEXT,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "usuarioId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Novidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL,
    "novidadeId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Novidade" ADD CONSTRAINT "Novidade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_novidadeId_fkey" FOREIGN KEY ("novidadeId") REFERENCES "Novidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
