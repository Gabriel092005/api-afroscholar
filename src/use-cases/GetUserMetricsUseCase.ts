import { prisma } from "@/lib/prisma";

interface GetUserMetricsRequest {
  usuarioId: string;
}

export class GetUserMetricsUseCase {
  async execute({ usuarioId }: GetUserMetricsRequest) {
    const [
      totalEmpresas,
      totalDepartamentos,
      totalImagens,
      totalVideos,
      totalPDFs
    ] = await Promise.all([
      
      // 1. Total de Empresas do Usuário
      prisma.empresa.count({
        where: { usuarioId }
      }),

      // 2. Total de Departamentos
      prisma.departamento.count({
        where: {
          empresa: { usuarioId }
        }
      }),

      // 3. Imagens (Filtrando via relação com Empresa)
      prisma.arquivo.count({
        where: {
          empresa: { usuarioId }, // AQUI: Acessamos o dono do arquivo via empresa
          tipo: {
            startsWith: 'image/',
            mode: 'insensitive',
          },
        },
      }),

      // 4. Vídeos (Filtrando via relação com Empresa)
      prisma.arquivo.count({
        where: {
          empresa: { usuarioId },
          tipo: {
            startsWith: 'video/',
            mode: 'insensitive',
          },
        },
      }),

      // 5. PDFs (Filtrando via relação com Empresa)
      prisma.arquivo.count({
        where: {
          empresa: { usuarioId },
          tipo: {
            contains: 'pdf',
            mode: 'insensitive',
          },
        },
      }),
    ]);

    const metrics = {
      totalEmpresas,
      totalDepartamentos,
      totalImagens,
      totalVideos,
      totalPDFs
    };

    return { metrics };
  }
}