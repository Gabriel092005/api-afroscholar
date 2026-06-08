import { CreateEmpresaUseCase } from "@/use-cases/create-new-empresa";
import { PrismaEmpresaRepository } from "./prisma-empresa-repository";

export function makeCadastrarEmpresaUseCase() {
  const repository = new PrismaEmpresaRepository();
  const useCase = new CreateEmpresaUseCase(repository);
  return useCase;
}

