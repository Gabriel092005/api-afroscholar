import { empresaRepository } from "@/repositories/empresa-repository";


export interface IEmpresaDTO {
  nome: string;
  sector: string;
  usuarioId: string;
  nif?: string;          // Opcional no banco, mas presente no modal
  contacto?: string;     // Opcional
  localizacao?: string;  // Opcional
  website?: string;      // Opcional
  logotipo?: string;     // Caminho da imagem ou Base64
  cor_primaria?: string; // Hexadecimal da cor
  descricao?: string;    // Descrição breve do negócio
  observacoes?: string;  // Notas internas
}

export class CreateEmpresaUseCase {
  constructor(private empresaRepository: empresaRepository) {}

  async execute(data: IEmpresaDTO) {

 
    const novaEmpresa = await this.empresaRepository.create({
      nome: data.nome,
      sector: data.sector,
      nif: data.nif, // ... campos restantes
      website:data.website,
      descricao:data.descricao,                                             
      contacto:data.contacto,
      cor_primaria:data.cor_primaria,
      localizacao:data.localizacao,
      logotipo:data.logotipo,
      observacoes:data.observacoes,
      usuario:{
        connect:{id:data.usuarioId}
      }
    });
    return novaEmpresa;
  }
}