import { Empresa, Prisma } from "@/generated/client";

export interface UpdateEmpresaDTO {
  nome?: string;
  descricao?: string;
  contacto?: string;
  localizacao?: string;
  cor_primaria?: string;
  website?: string;
  logotipo?: string;
}


export interface empresaRepository{
      create(data: Prisma.EmpresaCreateInput): Promise<Empresa>;
      findByNif(nif: string): Promise<Empresa | null>;
      findById(id: string): Promise<Empresa | null>;
      listAll(usuarioId: string): Promise<Empresa[]>; 
      listAll(usuarioId: string): Promise<Empresa[]>; 
      update(id: string, data: UpdateEmpresaDTO): Promise<void>;
      listLastSeven(usuarioId: string): Promise<Empresa[]>; 

}

