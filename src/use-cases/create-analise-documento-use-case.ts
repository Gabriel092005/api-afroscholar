import { prisma } from "@/lib/prisma";

interface CreateAnaliseDocumentoRequest {
  usuarioId: string;
  nome: string;
  email: string;
  telefone?: string;
  tipoDocumento: string;
  areaPretendida: string;
  observacao?: string;
  arquivoUrl?: string;
}

export class CreateAnaliseDocumentoUseCase {
  async execute(data: CreateAnaliseDocumentoRequest) {
    const analise = await prisma.analiseDocumento.create({
      data: {
        usuarioId: data.usuarioId,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        tipoDocumento: data.tipoDocumento,
        areaPretendida: data.areaPretendida,
        observacao: data.observacao,
        arquivoUrl: data.arquivoUrl,
        status: "PENDENTE",
      },
    });

    return { analise };
  }
}
