import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

const HORA_INICIO = 9;
const HORA_FIM = 16;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slotKey(d: Date): string {
  return `${isoDate(d)}T${pad(d.getHours())}:00`;
}

export const listConsultoriaSlots = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const { dias } = req.query as { dias?: string };
    const numDias = Math.min(Math.max(parseInt(dias || "14", 10) || 14, 1), 60);

    const bolsa = await prisma.bolsa.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!bolsa) {
      return res.status(404).send({
        error: "Not Found",
        message: "Bolsa não encontrada.",
      });
    }

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + numDias + 2);
    end.setHours(23, 59, 59, 999);

    const reservadas = await prisma.bolsaInscricao.findMany({
      where: {
        bolsaId: id,
        tipoInteresse: "CONSULTORIA",
        status: { in: ["PENDENTE", "APROVADA"] },
        dataAgendada: { not: null, gte: start, lte: end },
      },
      select: { dataAgendada: true },
    });

    const reservadasSet = new Set(
      reservadas
        .filter((r) => r.dataAgendada)
        .map((r) => slotKey(r.dataAgendada as Date))
    );

    const diasDisponiveis: { data: string; horarios: string[] }[] = [];
    const cursor = new Date(start);
    let diasAdicionados = 0;

    while (diasAdicionados < numDias) {
      const diaSemana = cursor.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        const horarios: string[] = [];
        for (let h = HORA_INICIO; h <= HORA_FIM; h++) {
          const slot = new Date(cursor);
          slot.setHours(h, 0, 0, 0);
          if (slot.getTime() <= now.getTime()) continue;
          if (reservadasSet.has(slotKey(slot))) continue;
          horarios.push(`${pad(h)}:00`);
        }
        if (horarios.length > 0) {
          diasDisponiveis.push({ data: isoDate(cursor), horarios });
        }
        diasAdicionados++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return res.send({ dias: diasDisponiveis });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar horários disponíveis.",
    });
  }
};
