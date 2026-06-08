import { empresaRepository } from "@/repositories/empresa-repository";


export interface IEmpresaDTO {
  empresaId: string;
}

export class getEmpresaUseCase {
  constructor(private empresaRepository: empresaRepository) {}

  async execute(data: IEmpresaDTO) {
    const {
        empresaId
    } = data

    const Empresa = await this.empresaRepository.findById(empresaId);
    return Empresa;
  }
}