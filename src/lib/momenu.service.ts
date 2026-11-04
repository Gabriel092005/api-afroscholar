import { env } from '@/Env';
import axios from 'axios';

const momenuClient = axios.create({
  baseURL: env.MOMENU_BASE_URL,
  timeout: 30_000,
  headers: {
    'x-api-key': env.MOMENU_API_KEY,
    'Content-Type': 'application/json',
    ...(env.MOMENU_QA === 'true' ? { 'x-env-qa': 'true' } : {}),
  },
});

// O POST do Express só responde depois de o cliente reagir no telemóvel.
const MCX_TIMEOUT_MS = 5 * 60 * 1000;

export interface MomenuProduct {
  id: string;
  productName: string;
  productPrice: number;
  productQuantity: number;
}

interface CobrancaDTO {
  amount: number;
  products: MomenuProduct[];
  /** Devolvido pela MoMenu em todos os webhooks; identifica a nossa cobrança. */
  merchantReferenceId: string;
}

export interface CreateMCXDTO extends CobrancaDTO {
  phoneNumber: string;
}

export interface CreateMCXResponse {
  success: boolean;
  transactionId: string;
  invoiceUrl?: string;
  /** "pending" significa que o cliente ainda tem de autorizar. */
  status?: string;
}

export type CreateReferenceDTO = CobrancaDTO;

export interface CreateReferenceResponse {
  success: boolean;
  operationId: string;
  transactionId: string;
  referenceNumber: string;
  entity: string;
  dueDate: string;
}

export type MomenuPaymentState = 'open' | 'paid' | 'failed';

export interface PaymentStatusResponse {
  success?: boolean;
  status: MomenuPaymentState;
  invoiceUrl?: string;
  failureReason?: string;
}

/** A API exige o formato 244XXXXXXXXX. */
function telefoneInternacional(telefone: string): string {
  return telefone.startsWith('244') ? telefone : `244${telefone}`;
}

export class MomenuService {

  static async createMCX(data: CreateMCXDTO): Promise<CreateMCXResponse> {
    const body = {
      merchantReferenceId: data.merchantReferenceId,
      paymentInfo: {
        amount: data.amount,
        phoneNumber: telefoneInternacional(data.phoneNumber),
      },
      products: data.products,
      instantWithdraw: true,
    };
    const response = await momenuClient.post<CreateMCXResponse>('/api/payment/mcx', body, {
      timeout: MCX_TIMEOUT_MS,
      headers: { 'Idempotency-Key': data.merchantReferenceId },
    });
    return response.data;
  }

  static async createReference(data: CreateReferenceDTO): Promise<CreateReferenceResponse> {
    const body = {
      merchantReferenceId: data.merchantReferenceId,
      paymentInfo: { amount: data.amount },
      products: data.products,
      instantWithdraw: true,
    };
    const response = await momenuClient.post<CreateReferenceResponse>('/api/payment/reference', body, {
      headers: { 'Idempotency-Key': data.merchantReferenceId },
    });
    return response.data;
  }

  static async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    const response = await momenuClient.get<PaymentStatusResponse>(
      `/api/payment/status/${encodeURIComponent(transactionId)}`
    );
    return response.data;
  }
}
