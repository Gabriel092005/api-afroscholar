
import { PrismaEmpresaRepository } from '@/repositories/prisma/prisma-empresa-repository';
import { getEmpresaUseCase } from '../get-empresa-profile';

export function makeGetEmpresasUseCase() {
  const repository = new PrismaEmpresaRepository();
  const useCase = new getEmpresaUseCase(repository);
  
  return useCase;
}