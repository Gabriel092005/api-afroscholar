import { UpdateEmpresaProfileUseCase } from "@/use-cases/update-empresa-profile-use-case";
import { PrismaEmpresaRepository } from "./prisma-empresa-repository";

export function makeUpdateEmpresaUseCase() {
  const repository = new PrismaEmpresaRepository();
  const useCase = new UpdateEmpresaProfileUseCase(repository);
  
  return useCase;
}