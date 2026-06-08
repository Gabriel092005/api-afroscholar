import { empresaRepository, UpdateEmpresaDTO } from "@/repositories/empresa-repository";

export class UpdateEmpresaProfileUseCase {
  constructor(private empresaRepository: empresaRepository) {}

  async execute(id: string, data: UpdateEmpresaDTO) {
    const empresa = await this.empresaRepository.findById(id);

    if (!empresa) {
      throw new Error("Empresa não encontrada.");
    }


    await this.empresaRepository.update(id, data);
    
    return { message: "Perfil atualizado com sucesso" };
  }
}