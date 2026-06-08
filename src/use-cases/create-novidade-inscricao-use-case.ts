import { prisma } from "@/lib/prisma";

interface CreateNovidadeInscricaoRequest {
  novidadeId: string;
  usuarioId: string;
  nome: string;
  email: string;
  telefone?: string;
  observacao?: string;
  metodoPagamento?: string;
  referenciaPagamento?: string;
  comprovativoUrl?: string;
  valorPago?: number;
  documentos?: { nome: string; file: string }[];
}

export class CreateNovidadeInscricaoUseCase {
  async execute(data: CreateNovidadeInscricaoRequest) {
    const inscricao = await prisma.novidadeInscricao.upsert({
      where: {
        novidadeId_usuarioId: {
          novidadeId: data.novidadeId,
          usuarioId: data.usuarioId,
        },
      },
      update: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        observacao: data.observacao,
        metodoPagamento: data.metodoPagamento,
        referenciaPagamento: data.referenciaPagamento,
        comprovativoUrl: data.comprovativoUrl,
        valorPago: data.valorPago,
        status: "PENDENTE",
        documentos: {
          deleteMany: {},
          create: data.documentos?.map(d => ({ nome: d.nome, file: d.file })) || [],
        },
      },
      create: {
        novidadeId: data.novidadeId,
        usuarioId: data.usuarioId,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        observacao: data.observacao,
        metodoPagamento: data.metodoPagamento,
        referenciaPagamento: data.referenciaPagamento,
        comprovativoUrl: data.comprovativoUrl,
        valorPago: data.valorPago,
        status: "PENDENTE",
        documentos: {
          create: data.documentos?.map(d => ({ nome: d.nome, file: d.file })) || [],
        },
      },
    });

    return { inscricao };
  }
}
