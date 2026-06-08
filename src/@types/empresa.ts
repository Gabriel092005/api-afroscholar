// src/api/empresas.ts

export interface Empresa {
  id: string;
  nome: string;
  sector: string;
  nif?: string;
  contacto?: string;
  localizacao?: string;
  website?: string | null;
  logotipo?: string | null;
  cor_primaria?: string | null;
  descricao?: string | null;
  observacoes?: string | null;
  created_at: string;
  usuarioId: string;
}

interface GetEmpresasResponse {
  empresas: Empresa[];
}

interface CreateEmpresaRequest {
  nome: string;
  sector: string;
  nif?: string;
  contacto?: string;
  localizacao?: string;
  website?: string;
  cor_primaria?: string;
  descricao?: string;
  observacoes?: string;
  image?: File; // Para o upload do logotipo
}