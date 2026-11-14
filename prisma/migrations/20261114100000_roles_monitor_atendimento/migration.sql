-- Monitor: acompanha os estudantes com o mesmo acesso de uma mentoria paga, em todas as bolsas.
ALTER TYPE "Role" ADD VALUE 'MONITOR';

-- Atendimento: equipa de vendas que recebe os alertas de vendas canceladas e a lista de contactos.
ALTER TYPE "Role" ADD VALUE 'ATENDIMENTO';
