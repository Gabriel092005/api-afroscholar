-- CreateTable
CREATE TABLE "mapa_global" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "bandeira" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "imagem" TEXT,
    "texto" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapa_global_pkey" PRIMARY KEY ("id")
);
