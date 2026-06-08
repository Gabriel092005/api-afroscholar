
import { PrismaEmpresaRepository } from '@/repositories/prisma/prisma-empresa-repository';
import { ListarEmpresasUseCase } from '@/use-cases/ListarEmpresasUseCase';

export function makeListarEmpresasUseCase() {
  const repository = new PrismaEmpresaRepository();
  const useCase = new ListarEmpresasUseCase(repository);
  
  return useCase;
}