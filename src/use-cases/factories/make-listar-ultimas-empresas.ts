
import { PrismaEmpresaRepository } from '@/repositories/prisma/prisma-empresa-repository';
import { ListarUltimasEmpresasUseCase } from '@/use-cases/ListarUltimasEmpresasUseCase';

export function makeListarUltimasEmpresasUseCase() {
  const repository = new PrismaEmpresaRepository();
  const useCase = new ListarUltimasEmpresasUseCase(repository);
  
  return useCase;
}