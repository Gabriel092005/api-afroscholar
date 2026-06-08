import {  Empresa, Prisma } from "@/generated/client";
import { empresaRepository, UpdateEmpresaDTO } from "../empresa-repository";
import prisma from "@/lib/prisma";

  export class PrismaEmpresaRepository implements empresaRepository{
  async update(id: string, data: UpdateEmpresaDTO) {
    await prisma.empresa.update({
      where: { id },
      data,
    });
  }
    async findById(id: string){  
    const empresa = await prisma.empresa.findUnique(
      { where: { id },
      include:{
        usuario:{
          select:{
            email:true,
            nome:true
          }
        }
      }
     });
    return empresa
    }
async listLastSeven(usuarioId: string) {
  return await prisma.empresa.findMany({
    where: { usuarioId },
    take: 7,
    orderBy: { created_at: 'desc' },
    include: {
      departamentos: {
        include: {
          bots: {
            include: {
              bot: true,
              folhas_pag: {
                orderBy: [
                  { ano: 'desc' },
                  { mes: 'desc' },
                ],
              }
            }
          }
        }
      },
      bots_alocados: {
        include: {
          bot: {
            include: {
              assets: true,
              whatBotCanDos: true,
              whatBotCanNotDos: true,
            }
          },
          departamento: true,
          empresa: {
            select: {
              id: true,
              nome: true,
              logotipo: true,
              cor_primaria: true,
              sector: true,
            }
          },
          folhas_pag: {
            orderBy: [
              { ano: 'desc' },
              { mes: 'desc' },
            ],
            include: {
              botEmpresa: {
                select: {
                  id: true,
                  botId: true,
                  empresaId: true,
                  departamentoId: true,
                  status: true,
                  data_contrato: true,
                }
              }
            }
          }
        }
      },
      transacoes: {
        orderBy: { created_at: 'desc' },
      },
      arquivos: {
        orderBy: { created_at: 'desc' },
      },
    }
  });
}
     async create(data: Prisma.EmpresaCreateInput) {
    return await prisma.empresa.create({ data });
  }
  async findByNif(nif: string) {
    return await prisma.empresa.findUnique({ where: { nif } });
  }

async listAll(usuarioId: string) {
  const empresas = await prisma.empresa.findMany({
    where: { usuarioId },
    include: {
      departamentos: {
        select: {
          id: true,
          nome: true,
          empresaId: true,
          bots: {
            select: {
              id: true,
              botId: true,
              empresaId: true,
              departamentoId: true,
              data_contrato: true,
              status: true,
              bot: {
                select: {
                  id: true,
                  nome: true,
                  funcao: true,
                  preco_mensal: true,   // ← obrigatório para fallback de valor
                  custo_api_est: true,  // ← obrigatório para fallback de custo
                  tags: true,
                  rating: true,
                }
              },
              folhas_pag: {            // ← obrigatório para valores reais do mês
                orderBy: [
                  { ano: 'desc' },
                  { mes: 'desc' },
                ],
                select: {
                  id: true,
                  botEmpresaId: true,
                  mes: true,
                  ano: true,
                  custo_api_real: true,
                  valor_cobrado: true,
                  horas_uso: true,
                }
              }
            }
          }
        }
      }
    },
    orderBy: { nome: 'asc' }
  });

  return empresas;
}
    
  }