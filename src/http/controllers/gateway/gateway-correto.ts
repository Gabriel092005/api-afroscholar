import crypto from "crypto";
import fetch from "node-fetch";

interface BizContent {
  payer_ip: string;
  timeout_express: string;
  sale_product_code: string;
  cashier_type: string;
  out_trade_no: string;
  subject: string;
  currency: string;
  price: number;
  quantity: number;
  total_amount: number;
  trade_info: {
    currency: string;
    out_trade_no: string;
    payee_identity: string;
    payee_identity_type: string;
    price: number;
    quantity: string;
    subject: string;
    total_amount: number;
  };
  pay_method: {
    pay_product_code: string;
    amount: number;
    bank_code: string;
  };
}

interface ExpressPaymentParams {
  total: number;
}

/** Gera string aleatória (hexadecimal) */
function generateRandomString(length = 32): string {
  return crypto.randomBytes(length / 2).toString("hex");
}

/** Retorna o timestamp no formato ISO UTC */
function getCurrentTimestamp(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

/** Encripta o biz_content usando chave privada RSA */
function encryptBizContent(data: BizContent, privateKeyPem: string): string {
  const jsonData = JSON.stringify(data);
  const buffer = Buffer.from(jsonData);
  const chunkSize = 117; // 1024-bit key = 117 bytes RSA chunk
  const encryptedChunks: string[] = [];

  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.slice(i, i + chunkSize);
    const encryptedChunk = crypto.privateEncrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      chunk
    );
    encryptedChunks.push(encryptedChunk.toString("base64"));
  }

  return encryptedChunks.join("");
}

/** Gera assinatura SHA1 com RSA */
function generateSignature(
  params: Record<string, any>,
  privateKeyPem: string
): string {
  const keys = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type")
    .sort();

  const signString = keys
    .map((key) => `${key}=${decodeURIComponent(params[key])}`)
    .join("&");

  const signer = crypto.createSign("RSA-SHA1");
  signer.update(signString);
  const signature = signer.sign(privateKeyPem, "base64");
  return signature;
}

/** Cria pagamento Express */
export async function createExpressPayment({
  total,
}: ExpressPaymentParams): Promise<any> {
  const partnerId = "coloca_aqui_teu_partner_id";

  const privateKey = `
-----BEGIN PRIVATE KEY-----
coloca_aqui_tua_chave_privada
-----END PRIVATE KEY-----
`;

  const bizContent: BizContent = {
    payer_ip: "192.168.1.1",
    timeout_express: "10m",
    sale_product_code: "050200020",
    cashier_type: "SDK",
    out_trade_no: generateRandomString(24),
    subject: "Pagamento na Loja Virtual",
    currency: "AOA",
    price: total,
    quantity: 1,
    total_amount: total,
    trade_info: {
      currency: "AOA",
      out_trade_no: generateRandomString(24),
      payee_identity: partnerId,
      payee_identity_type: "1",
      price: total,
      quantity: "1",
      subject: "Pagamento de produtos",
      total_amount: total,
    },
    pay_method: {
      pay_product_code: "31", // MCX (Multicaixa Express)
      amount: total,
      bank_code: "REF",
    },
  };

  // Criptografa o biz_content
  const encryptedBizContent = encryptBizContent(bizContent, privateKey);

  const requestBody: Record<string, any> = {
    request_no: generateRandomString(),
    service: "instant_trade",
    version: "1.0",
    partner_id: partnerId,
    charset: "UTF-8",
    language: "pt",
    sign_type: "RSA",
    timestamp: getCurrentTimestamp(),
    format: "JSON",
    biz_content: encodeURIComponent(encryptedBizContent),
  };

  // Gera a assinatura
  requestBody.sign = generateSignature(requestBody, privateKey);

  // Envia requisição ao PayPay
  const response = await fetch("https://gateway.paypayafrica.com/recv.do", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status}`);
  }

  return response.json();
}

(async () => {
  try {
    const res = await createExpressPayment({ total: 500 });
    if (process.env.NODE_ENV !== 'production') {
      console.log("✅ Resultado:", res);
    }
  } catch (err) {
    console.error("❌ Erro:", err);
  }
})();
