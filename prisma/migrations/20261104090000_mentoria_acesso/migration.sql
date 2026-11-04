-- Acesso de quem pagou uma mentoria: não se perde ao comprar outro serviço da mesma bolsa.
CREATE TABLE "mentoria_acessos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "bolsaId" TEXT,
    "mentoriaId" TEXT,
    "pago" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentoria_acessos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mentoria_acessos_usuarioId_bolsaId_key" ON "mentoria_acessos"("usuarioId", "bolsaId");
CREATE UNIQUE INDEX "mentoria_acessos_usuarioId_mentoriaId_key" ON "mentoria_acessos"("usuarioId", "mentoriaId");
CREATE INDEX "mentoria_acessos_bolsaId_idx" ON "mentoria_acessos"("bolsaId");

ALTER TABLE "mentoria_acessos" ADD CONSTRAINT "mentoria_acessos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentoria_acessos" ADD CONSTRAINT "mentoria_acessos_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentoria_acessos" ADD CONSTRAINT "mentoria_acessos_mentoriaId_fkey" FOREIGN KEY ("mentoriaId") REFERENCES "mentorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PDFs ligados a uma bolsa. Saem com ela, para nunca ficarem públicos sozinhos.
ALTER TABLE "documentos" ADD COLUMN "bolsaId" TEXT;
CREATE INDEX "documentos_bolsaId_idx" ON "documentos"("bolsaId");
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem já tinha a mentoria aprovada mantém o acesso.
INSERT INTO "mentoria_acessos" ("id", "usuarioId", "bolsaId", "pago")
SELECT gen_random_uuid()::text, i."usuarioId", i."bolsaId", COALESCE(i."metodoPagamento", '') <> 'GRATUITO'
FROM "BolsaInscricao" i
WHERE i."tipoInteresse" = 'MENTORIA' AND i."status" = 'APROVADA'
ON CONFLICT DO NOTHING;

INSERT INTO "mentoria_acessos" ("id", "usuarioId", "bolsaId", "mentoriaId", "pago")
SELECT gen_random_uuid()::text, mi."usuarioId", m."bolsaId", m."id", m."preco" > 0
FROM "mentorias_inscricoes" mi
JOIN "mentorias" m ON m."id" = mi."mentoriaId"
WHERE mi."status" = 'APROVADA'
ON CONFLICT DO NOTHING;

-- E entra já nas comunidades dessas bolsas, sem esperar por aprovação.
INSERT INTO "CommunityMember" ("id", "status", "comunidadeId", "usuarioId")
SELECT gen_random_uuid()::text, 'APROVADO', c."id", a."usuarioId"
FROM "mentoria_acessos" a
JOIN "Community" c ON c."bolsaId" = a."bolsaId"
ON CONFLICT ("comunidadeId", "usuarioId") DO UPDATE SET "status" = 'APROVADO';
