-- Regista quando os monitores foram avisados de um novo mentorando numa comunidade.
ALTER TABLE "CommunityMember" ADD COLUMN "monitoresAvisadosEm" TIMESTAMP(3);
