import { upload } from "@/lib/upload";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const inscribirSchema = z.object({
  tipoInteresse: z.enum(["CONSULTORIA", "MENTORIA", "INSCRICAO"]).optional(),
  observacoes: z.string().optional(),
  nome: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
  metodoPagamento: z.string().optional(),
  referenciaPagamento: z.string().optional(),
  dataAgendada: z.string().optional(),
});

function validarAgendamento(dataAgendadaRaw?: string): { data?: Date; erro?: string } {
  if (!dataAgendadaRaw) {
    return { erro: "Selecione a data e hora da consultoria." };
  }

  const data = new Date(dataAgendadaRaw);
  if (isNaN(data.getTime())) {
    return { erro: "Data de agendamento inválida." };
  }

  const diaSemana = data.getDay();
  if (diaSemana === 0 || diaSemana === 6) {
    return { erro: "Selecione um dia útil (segunda a sexta)." };
  }

  const hora = data.getHours();
  if (hora < 9 || hora > 16 || data.getMinutes() !== 0) {
    return { erro: "Selecione um horário em ponto entre 09:00 e 16:00." };
  }

  if (data.getTime() <= Date.now()) {
    return { erro: "Selecione uma data e hora futuras." };
  }

  return { data };
}

export const inscribirBolsa = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req.user as any)?.sub;

    if (!userId) {
      return res.status(401).send({
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
    }

    await new Promise<void>((resolve, reject) => {
      upload.fields([
        { name: "comprovativo", maxCount: 1 },
        { name: "docFile", maxCount: 10 },
      ])(req.raw as any, res.raw as any, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const rawReq = req.raw as any;
    const files = rawReq.files as { [fieldname: string]: Express.Multer.File[] } || {};
    const comprovativoFile = files["comprovativo"]?.[0];
    const docFiles = files["docFile"] || [];
    const docNomes = rawReq.body.docNome
      ? (Array.isArray(rawReq.body.docNome) ? rawReq.body.docNome : [rawReq.body.docNome])
      : [];

    const body = inscribirSchema.parse(rawReq.body);

    const bolsa = await prisma.bolsa.findUnique({
      where: { id },
    });

    if (!bolsa) {
      return res.status(404).send({
        error: "Not Found",
        message: "Bolsa não encontrada.",
      });
    }

    let dataAgendada: Date | undefined;
    if (body.tipoInteresse === "CONSULTORIA") {
      const agendamento = validarAgendamento(body.dataAgendada);
      if (agendamento.erro) {
        return res.status(400).send({
          error: "Validation Error",
          message: agendamento.erro,
        });
      }

      const conflito = await prisma.bolsaInscricao.findFirst({
        where: {
          bolsaId: id,
          tipoInteresse: "CONSULTORIA",
          status: { in: ["PENDENTE", "APROVADA"] },
          dataAgendada: agendamento.data,
          NOT: { usuarioId: userId },
        },
      });

      if (conflito) {
        return res.status(409).send({
          error: "Conflict",
          message: "Este horário já está reservado. Escolha outro.",
        });
      }

      dataAgendada = agendamento.data;
    }

    const documentosData = docFiles.map((f, i) => ({
      file: f.filename,
      nome: docNomes[i] || `Documento ${i + 1}`,
    }));

    const inscricao = await prisma.bolsaInscricao.upsert({
      where: {
        bolsaId_usuarioId: {
          bolsaId: id,
          usuarioId: userId,
        },
      },
      update: {
        tipoInteresse: body.tipoInteresse,
        observacoes: body.observacoes,
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        metodoPagamento: body.metodoPagamento,
        referenciaPagamento: body.referenciaPagamento,
        comprovativoUrl: comprovativoFile ? comprovativoFile.filename : undefined,
        dataAgendada: dataAgendada,
        duracaoMinutos: dataAgendada ? 60 : undefined,
        status: "PENDENTE",
        documentos: {
          deleteMany: {},
          create: documentosData,
        },
      },
      create: {
        bolsaId: id,
        usuarioId: userId,
        tipoInteresse: body.tipoInteresse,
        observacoes: body.observacoes,
        nome: body.nome,
        email: body.email,
        telefone: body.telefone,
        metodoPagamento: body.metodoPagamento,
        referenciaPagamento: body.referenciaPagamento,
        comprovativoUrl: comprovativoFile ? comprovativoFile.filename : undefined,
        dataAgendada: dataAgendada,
        duracaoMinutos: dataAgendada ? 60 : undefined,
        documentos: {
          create: documentosData,
        },
      },
    });

    return res.status(200).send({
      id: inscricao.id,
      message: "Inscrição realizada com sucesso",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        issues: error.format(),
      });
    }
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao fazer inscrição.",
    });
  }
};