import type { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";

/**
 * Liberta o acesso aos cursos de uma bolsa para um utilizador.
 * Cria/atualiza o CursoPagamento como APROVADO (é o que /cursos/comprados usa)
 * e a matrícula CursoUsuario, incrementando o contador de estudantes apenas uma vez.
 */
export async function liberarAcessoBolsa(
  usuarioId: string,
  bolsaId: string,
  db: Prisma.TransactionClient = prisma
): Promise<string[]> {
  const cursos = await db.curso.findMany({
    where: { bolsaId },
    select: { id: true },
  });

  for (const curso of cursos) {
    await liberarCurso(usuarioId, curso.id, db);
  }

  return cursos.map((c) => c.id);
}

export async function liberarCurso(
  usuarioId: string,
  cursoId: string,
  db: Prisma.TransactionClient = prisma
) {
  const jaMatriculado = await db.cursoUsuario.findUnique({
    where: { cursoId_usuarioId: { cursoId, usuarioId } },
  });

  await db.cursoPagamento.upsert({
    where: { cursoId_usuarioId: { cursoId, usuarioId } },
    update: {
      status: "APROVADO",
      observacoes: "Acesso liberado pela inscrição na bolsa",
    },
    create: {
      cursoId,
      usuarioId,
      valor: 0,
      metodo: "BOLSA",
      status: "APROVADO",
      observacoes: "Acesso liberado pela inscrição na bolsa",
    },
  });

  if (!jaMatriculado) {
    await db.cursoUsuario.create({ data: { cursoId, usuarioId } });
    await db.curso.update({
      where: { id: cursoId },
      data: { estudantes: { increment: 1 } },
    });
  }
}
