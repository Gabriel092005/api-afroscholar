
Webhook obrigatório para referência bancária. Configure o URL em Desenvolvedores. A confirmação chega apenas por webhook.

URL DO WEBHOOK = https://headed-prude-trapping.ngrok-free.dev




https://api.momenu.online/api/payment/mcx

{
    "paymentInfo": {
      "amount": 1000,
      "phoneNumber": "956453825"
    },
    "products": [
      { "id": "1", "productName": "Produto", "productPrice": 1000, "productQuantity": 1 }
    ],
    "instantWithdraw": true
  }

x-api-key  = <MOMENU_API_KEY>
Content-Type = application/json


Formato de resposta da API (Referência / MCX)
O que diz a documentação da MoMenu:

Para Multicaixa Express (MCX) (POST /api/payment/mcx), a resposta de sucesso retorna um transactionId e um invoiceUrl:

JSON
{
  "success": true,
  "transactionId": "abc123...",
  "invoiceUrl": "https://invoice-momenu.toquemedia.net/invoices/..."
}
Para Referência Bancária (POST /api/payment/reference), a resposta de sucesso retorna o ID da operação, a referência, a entidade e a data limite:

JSON
{
  "success": true,
  "operationId": "op-123...",
  "transactionId": "17066400000000",
  "referenceNumber": "123456789",
  "entity": "12345",
  "dueDate": "2024-01-20"
}
Solução: Deves mapear o campo correto consoante o tipo de pagamento. Para Referência Bancária, o identificador principal para consultas/guardar na base de dados é transactionId (ou referenceNumber para o cliente pagar no Multicaixa/ATM). Evita usar referenceId genérico, pois a API retorna explicitamente transactionId e referenceNumber.

2. Status do pagamento (getPaymentStatus)
O que diz a documentação:

O endpoint correto para verificar o estado de uma ordem é GET /api/payment/status/:id, onde o :id é o transactionId obtido na criação.

Exemplo:

Bash
curl -X GET "https://api.momenu.online/api/payment/status/ab12cd34ef56" \
  -H "x-api-key: SUA_API_KEY"
Respostas possíveis: open (em aberto/aguardar), paid (pago) ou failed (falhado). Partilha o limite geral de 100 requisições/minuto.

3. Webhook de confirmação automática
O que diz a documentação:

A MoMenu suporta webhooks robustos (essenciais para Referências Bancárias, já que o MCX é síncrono na resposta do POST).

Quando ocorre um pagamento, a API envia dois eventos sequenciais para o teu endpoint configurado no painel:

payment.confirmed — Confirma que o pagamento foi liquidado (traz o transactionId e operationId).

invoice.created — Disponibiliza o invoiceUrl com o PDF da fatura gerada automaticamente.

Ação recomendada: Configura um endpoint de webhook no teu backend (verificando sempre a assinatura com o header x-webhook-signature e o segredo HMAC-SHA-256) para atualizar automaticamente o estado da mentoria/inscrição na base de dados sem precisar de aprovação manual.

4. Preço da mentoria fixo em 100
O problema: O modelo de dados atual não está a refletir dinamicamente o valor correto da mentoria.

Solução: Deves alterar o schema do Prisma para incluir um campo preco (ou valor) no modelo da Mentoria (ou puxar de Bolsa.precoMentoria). Como o valor mínimo exigido pela MoMenu atualmente é de 100 KZ (BELOW_MINIMUM se for inferior), certifica-te de que o preço calculado nunca fica abaixo deste valor.

5. Erro no prisma generate (EPERM com ficheiros .tmp*)
A causa: O Windows ou um processo Node.js em background está a bloquear a substituição da DLL do motor do Prisma (query_engine).

Solução passo a passo:

Fecha todos os terminais abertos e instâncias do Node.js / VS Code que possam estar a usar o projeto.

Abre o gestor de tarefas para garantir que nenhum processo node.exe ficou preso.

No terminal, limpa os ficheiros temporários e gera novamente:

Bash
npx prisma generate
Aplica a migração para garantir que os campos metodoPagamento e referenciaPagamento ficam ativos na base de dados:

Bash
npx prisma migrate dev --name add_payment_fields
O que queres fazer a seguir?
Queres que eu ajude a escrever o bloco de código em Node.js / Express para tratar o payload correto da MoMenu (com paymentInfo, products e instantWithdraw: true), ou preferes focar primeiro em resolver o bloqueio do Prisma e estruturar o webhook?

Referência Bancária
POST
/api/payment/reference
Gerar referência de pagamento
Gera uma referência bancária para pagamento. A ordem é criada com estado OPEN. O cliente paga através do ATM ou Internet Banking usando a entidade e referência fornecidas. A referência fica associada ao número de telefone do cliente — o pagamento exige esse número, portanto customer.phone é obrigatório. Quando o pagamento é confirmado, o estado é actualizado apenas por webhook (payment.confirmed e, em seguida, invoice.created). O URL de webhook é obrigatório na conta.

PARÂMETRO	TIPO	DESCRIÇÃO
paymentInfo.amountObrigatório	number	Valor do pagamento em Kwanzas
productsObrigatório	array	Lista de produtos da fatura (mínimo 1, mesma estrutura do MCX). iva default 0 quando omitido.
customer.phoneOpcional	string	Número de telefone do cliente (ex.: 923456789). Quando enviado, a referência fica associada a este número. Os restantes campos de customer (name, nif) continuam opcionais.
customerOpcional	object	Dados do cliente (mesma estrutura do MCX)
instantWithdrawObrigatório	boolean	Levantamento instantâneo após confirmação do pagamento da referência. Obrigatório e tem de ser true (desde 22/06/2026). Requer conta bancária verificada.
splitOpcional	boolean	Mesma regra do MCX. Ver Split de pagamentos.
iban / isPercent / value	string / boolean / number	Obrigatórios quando split: true: iban, value, beneficiaryName, beneficiaryNif, description. isPercent opcional.
merchantReferenceIdOpcional	string	ID livre do comerciante, de 1 a 200 caracteres. Independente do ID da transacção; devolvido exactamente como enviado na resposta, nas consultas e nos webhooks. Não é uma chave de idempotência.
externalReferenceOpcional	string	Referência própria do integrador (1 a 200 caracteres). Devolvida na resposta de criação, em todos os eventos do webhook e no GET /api/payment/status/{transactionId} — usem-na para reconciliar confirmações sem depender do montante.
EXEMPLO DE REQUISIÇÃO
📋 Copiar
curl -X POST https://api.momenu.online/api/payment/reference \
  -H "Content-Type: application/json" \
  -H "x-api-key: sua_api_key" \
  -d '{
    "paymentInfo": {
      "amount": 10000
    },
    "products": [
      {
        "id": "1",
        "productName": "Produto",
        "productPrice": 10000,
        "productQuantity": 1,
        "iva": 14
      }
    ],
    "customer": {
      "name": "Cliente",
      "nif": "123456789",
      "phone": "923456789"
    },
    "instantWithdraw": true
  }'
RESPOSTA DE SUCESSO (200)
{
  "success": true,
  "operationId": "op-123...",
  "transactionId": "17066400000000",
  "referenceNumber": "123456789",
  "entity": "12345",
  "dueDate": "2024-01-20"
}
🔑
Referências duplicadas — Idempotency-Key (opcional): enviem o header Idempotency-Key com um valor único por intenção de pagamento. Um retry com a mesma chave devolve a resposta original (a mesma referência) em vez de criar uma segunda — cache de 24 horas, apenas respostas de sucesso, com o header Idempotency-Replayed: true na repetição. Cada referência só pode ser paga uma vez; uma nova referência para o mesmo cliente exige uma chave nova (ou nenhum header).
Split de pagamentos (marketplace)
O comerciante M integra a API na sua plataforma e permite que outros comerciantes (M1) vendam lá. Com split: true, o valor pago pelo cliente final é repartido depois da taxa de 2% do MoMenu.

Exemplo: venda de 10.000 Kz com comissão 10%
PARTE	VALOR (KZ)	DESTINO
Pagamento	10.000,00	Cliente final → MoMenu
Taxa MoMenu (2%)	200,00	Plataforma
Comerciante M (10% do líquido)	980,00	IBAN verificado no MoMenu
Comerciante M1 (resto)	8.820,00	IBAN do payload
value + isPercent são a comissão do M. O resto vai para o iban (M1).
A taxa MoMenu de 2% incide apenas no bruto (grossAmount). Não é cobrada sobre platformAmount nem sobre beneficiaryAmount.
A comissão e o restante ficam nas transacções do integrador (KWiK com o description do payload, fee: 0). A taxa de 2% é a única linha nas transacções Toque Media (feeTransactions).
O platformAmount é a comissão facturada ao beneficiário: emite-se uma FR electrónica com QR AGT. Exige beneficiaryName, beneficiaryNif e description. O número/URL vêm em split.platformInvoiceNumber / platformInvoiceUrl e o invoiceUrl da venda na raiz da resposta.
Aplica-se só a MCX e Referência. E-kwanza, POOL/PLAN, links de pagamento e merchants isentos → SPLIT_NOT_SUPPORTED.
Cada perna tem de ser ≥ 50 Kz (piso KWiK) → senão SPLIT_LEG_BELOW_MINIMUM.
A factura da venda continua a ser o FR do M ao cliente final (bruto). A FR da comissão é um documento à parte, do M para o M1.
status: pending (referência ainda não paga) → processing (pagamento confirmado, KWiK a correr) → completed | partial | failed. Em failed/partial pode vir reason.
O KWiK corre em background. A iniciação devolve os valores calculados; o estado actualizado do repasse vem no webhook payment.confirmed e numa leitura de GET /api/payment/status/:id.
Se o limite diário KWiK não chegar para as duas pernas, nenhuma é enviada (o líquido fica em saldo do M, levantável à mão).
Se o IBAN do M1 for o mesmo da conta verificada do M, envia-se um KWiK com o líquido inteiro; o objecto split mantém o detalhe da comissão.
PEDIDO COM SPLIT
{
  "paymentInfo": { "amount": 10000, "phoneNumber": "244923456789" },
  "products": [{ "id": "1", "productName": "Artigo", "productPrice": 10000, "productQuantity": 1 }],
  "instantWithdraw": true,
  "split": true,
  "iban": "AO06000000000000000000001",
  "isPercent": true,
  "value": 10,
  "beneficiaryName": "Loja M1",
  "beneficiaryNif": "5417000000",
  "description": "Comissão de marketplace pela venda"
}
split é um campo adicional. A resposta continua a incluir success, transactionId e invoiceUrl (quando a factura já existe).

RESPOSTA MCX COM SPLIT (200)
{
  "success": true,
  "transactionId": "abc123...",
  "invoiceUrl": "https://invoice-momenu.toquemedia.net/invoices/...",
  "status": "paid",
  "split": {
    "iban": "AO06000000000000000000001",
    "isPercent": true,
    "value": 10,
    "date": "2026-08-31T12:00:00.000Z",
    "grossAmount": 10000,
    "feeAmount": 200,
    "netAmount": 9800,
    "platformAmount": 980,
    "beneficiaryAmount": 8820,
    "status": "processing",
    "orderId": "abc123...",
    "beneficiaryName": "Loja M1",
    "beneficiaryNif": "5417000000",
    "description": "Comissão de marketplace pela venda",
    "platformInvoiceUrl": "https://invoice-momenu.toquemedia.net/invoices/..."
  }
}
Retomar um split
Em Transações, use Retomar split para reconciliar as transferências e concluir apenas as parcelas comprovadamente por pagar, mantendo os destinos e valores originais. O saldo permanece reservado ao split. A retoma ajusta apenas parcelas nunca submetidas para aproveitar a quota diária, respeitando o mínimo bancário de 50 Kz. Por exemplo, 4.900.000 Kz podem avançar 4.000.000 Kz num dia e manter 900.000 Kz reservados para nova retoma no dia seguinte, se não houver outros envios ou falhas bancárias.

POST /api/withdraw/split/:orderId/resume
{}
Consulte os pagamentos em GET /api/withdraw/splits. Também pode enviar apenas { "orderId": "ID-original" } e o código 2FA no levantamento manual. A retoma exige sessão do titular e validação 2FA no servidor; UID/API key não autoriza a retoma. Não envie montante nem IBAN na retoma. Resposta 200: concluído; 202: aguarda reconciliação, limite diário ou resolução de rejeição bancária. Não se duplicam taxas nem se reemitem facturas existentes.

ID do comerciante: merchantReferenceId
Opcional em MCX, Referência e E-kwanza. Envie uma string não vazia até 200 caracteres para identificar o pagamento no seu sistema. O mesmo valor é devolvido, sem alterações, na resposta e nos webhooks de confirmação, falha e factura. Os IDs da transacção continuam separados.

{ "merchantReferenceId": "ORDER-2026-0001", "paymentInfo": { "amount": 1000 } }
Confirme o pagamento quando receber payment.confirmed, usando merchantReferenceId para localizar o seu registo. O campo não evita novas cobranças: para repetir um pedido com Idempotency-Key, mantenha o mesmo ID. externalReference continua disponível.

Webhook
O webhook é obrigatório na referência bancária. Esse pagamento fica em aberto e a confirmação, em produção e em QA (x-env-qa: true), chega só ao URL configurado na conta. O Multicaixa Express é síncrono: o resultado vem na resposta do pedido e não exige webhook.

Como funciona
1. Faça login na sua conta em momenu.toquemedia.net
2. Aceda ao menu Desenvolvedores
3. Adicione a sua URL de webhook
4. Guarde a configuração
Vários serviços na mesma conta: cada API key gerada em Desenvolvedores pode ter o seu próprio webhook (URL, segredo e "Assinatura apenas"). Os pagamentos feitos com essa key notificam o webhook dela; a key original e as keys sem webhook próprio (ou com ele desligado) usam o webhook da conta.

Autenticação e assinatura
Cada pedido é assinado com o segredo configurado no painel (x-webhook-signature + x-webhook-timestamp) e leva um x-webhook-id estável entre tentativas. Veja como verificar em Webhooks assinados.

A entrega é at-least-once: o mesmo evento pode chegar mais do que uma vez (por exemplo, se o vosso 200 chegar depois do nosso timeout de 10s). Tornem o processamento idempotente por x-webhook-id ou merchantTransactionId — um segundo payment.confirmed para o mesmo identificador deve ser ignorado, não processado duas vezes.

Cada evento e o resultado de cada tentativa (código HTTP, motivo da falha, resposta do vosso servidor) ficam visíveis no painel em Desenvolvedores → Webhooks. Se o vosso sistema falhou a processar um pagamento já feito, reenviem o evento a partir daí — o cliente não precisa de pagar outra vez.

Eventos do Webhook
Quando um pagamento é confirmado, o webhook envia dois eventos sequenciais:

payment.confirmed — Enviado imediatamente após o pagamento ser confirmado. Além do merchantTransactionId, inclui operationId — o identificador devolvido na criação do pagamento — para reconciliar com o registo guardado. Permite atualizar o estado da encomenda no seu sistema antes da fatura estar pronta. Se o pedido teve split: true, o payload inclui o objecto split (estado processing ou posterior).
invoice.created — Enviado após a fatura ser gerada e disponível para download. Inclui o campo invoiceUrl com o link para o PDF.
webhook.test — Só quando pede um teste em Desenvolvedores → Webhooks → Enviar evento de teste. Assinado como os outros, com test: true, operationStatus: "test" e merchantTransactionId TEST-…. Responda 2xx e não o trate como pagamento.
Fluxo de eventos

Pagamento confirmado
  |
  |-- POST webhook: { event: "payment.confirmed", ... }
  |
  Gerar fatura + Upload PDF
  |
  |-- POST webhook: { event: "invoice.created", ..., invoiceUrl }

EVENTO: PAYMENT.CONFIRMED
{
  "event": "payment.confirmed",
  "merchantTransactionId": "abc123...",
  "ekwanzaTransactionId": "EKZ456...",
  "operationStatus": "1",
  "operationData": { ... },
  "split": { /* presente se o pagamento foi criado com split:true */ }
}
EVENTO: INVOICE.CREATED
{
  "event": "invoice.created",
  "merchantTransactionId": "abc123...",
  "ekwanzaTransactionId": "EKZ456...",
  "operationStatus": "1",
  "operationData": { ... },
  "invoiceUrl": "https://invoice-momenu.toquemedia.net/invoices/..."
}
💡
Valores de operationStatus: "1" Pago com sucesso · "3" Cancelado/Expirado · "4" Falhado/Recusado · "5" Erro

Nota: Eventos com status diferente de "1" (cancelado, falhado, erro) são enviados sem o campo event, mantendo compatibilidade com integrações existentes.
EXEMPLO - NODE.JS / EXPRESS
SERVIDOR WEBHOOK
📋 Copiar
const express = require("express");
const app = express();

app.use(express.json());

app.post("/webhook/meu-webhook", (req, res) => {
  const { event, merchantTransactionId, operationStatus, invoiceUrl } = req.body;

  switch (event) {
    case "payment.confirmed":
      console.log("Pagamento confirmado:", merchantTransactionId);
      // Atualizar estado da encomenda no seu sistema
      break;

    case "invoice.created":
      console.log("Fatura disponivel:", invoiceUrl);
      // Guardar URL da fatura, enviar ao cliente
      break;

    default:
      // Eventos sem campo "event" (cancelado, falhado, erro)
      if (["3", "4", "5"].includes(operationStatus)) {
        console.log("Pagamento falhou:", operationStatus);
      }
  }

  res.status(200).json({ received: true });
});

app.listen(3000);
EXEMPLO - PYTHON / FLASK
SERVIDOR WEBHOOK
📋 Copiar
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/webhook/meu-webhook", methods=["POST"])
def momenu_webhook():
    data = request.json
    event = data.get("event")
    transaction_id = data.get("merchantTransactionId")
    status = data.get("operationStatus")

    if event == "payment.confirmed":
        print(f"Pagamento confirmado: {transaction_id}")
        # Atualizar estado da encomenda

    elif event == "invoice.created":
        invoice_url = data.get("invoiceUrl")
        print(f"Fatura disponivel: {invoice_url}")
        # Guardar URL da fatura

    elif status in ["3", "4", "5"]:
        print(f"Pagamento falhou: {status}")

    return jsonify({"received": True}), 200
⚠
Obrigatório na referência: sem URL de webhook, POST /api/payment/reference devolve 400 WEBHOOK_REQUIRED. O webhook é quem marca a referência como paga (payment.confirmed, depois invoice.created), também em QA. GET /api/payment/status/:id mostra o estado já gravado. O Multicaixa Express não exige webhook. Responda 2xx. A entrega é repetida até 3 vezes.
Webhooks assinados
Cada notificação que enviamos é assinada com o Segredo do Webhook que definiu em Desenvolvedores. Verificar a assinatura garante que o pedido veio da MoMenu, que o corpo não foi alterado e que não é uma repetição antiga. Sem segredo configurado, o webhook chega sem assinatura e qualquer pessoa que conheça o seu URL poderia forjar um payment.confirmed — configure sempre um segredo.

Cabeçalhos enviados
Cabeçalho	Conteúdo
x-webhook-signature	HexEncode(HMAC-SHA-256(segredo, timestamp + "." + corpo bruto)), em minúsculas. Enviado sempre que há segredo.
x-webhook-timestamp	Data e hora ISO-8601 (UTC) do envio, ex.: 2026-10-20T14:03:11.482Z. Faz parte da assinatura.
x-webhook-id	Identificador único do evento. É o mesmo em todas as tentativas e reenvios do mesmo evento — use-o para descartar entregas repetidas. Enviado sempre, com ou sem segredo.
x-webhook-redelivery	true só quando o evento foi reenviado manualmente em Desenvolvedores → Webhooks. O corpo é igual ao original; a assinatura e o timestamp são novos.
x-webhook-secret	Legado. O próprio segredo, em claro. Mantido para integrações antigas que comparam o valor literal. Active "Assinatura apenas" em Desenvolvedores para deixar de o receber — recomendado: assim o segredo nunca viaja no pedido nem fica em logs de proxies.
Como verificar
1. Leia o corpo bruto do pedido (os bytes exactos), antes de qualquer parse de JSON. Re-serializar o JSON altera espaços e a ordem das chaves e a assinatura deixa de bater.
2. Concatene x-webhook-timestamp + "." + corpo bruto.
3. Calcule o HMAC-SHA-256 com o seu segredo e codifique em hexadecimal.
4. Compare com x-webhook-signature em tempo constante (crypto.timingSafeEqual, hmac.compare_digest, hash_equals). Se não coincidir, responda 401.
5. Rejeite timestamps a mais de 5 minutos do seu relógio (protecção contra repetição de pedidos interceptados).
6. Processe de forma idempotente: guarde o x-webhook-id (ou o par merchantTransactionId + event) e ignore o que já tratou. Responda 2xx logo que aceitar o evento.
VERIFICAÇÃO - NODE.JS / EXPRESS
WEBHOOK ASSINADO
📋 Copiar
const express = require("express");
const crypto = require("crypto");

const SECRET = process.env.MOMENU_WEBHOOK_SECRET;
const TOLERANCE_MS = 5 * 60 * 1000;
const app = express();

// express.raw: precisamos dos bytes exactos para a assinatura
app.post("/webhook/momenu", express.raw({ type: "*/*" }), (req, res) => {
  const timestamp = req.get("x-webhook-timestamp") || "";
  const signature = req.get("x-webhook-signature") || "";

  const age = Math.abs(Date.now() - Date.parse(timestamp));
  if (!(age <= TOLERANCE_MS)) return res.status(401).end();

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(timestamp + ".")
    .update(req.body) // Buffer com o corpo bruto
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).end();
  }

  const event = JSON.parse(req.body.toString("utf8"));
  const webhookId = req.get("x-webhook-id");
  // if (await jaProcessado(webhookId)) return res.sendStatus(200);
  // ... actualizar a encomenda event.merchantTransactionId ...
  res.status(200).json({ received: true });
});
VERIFICAÇÃO - PYTHON / FLASK
WEBHOOK ASSINADO
📋 Copiar
import hmac, hashlib, json, os
from datetime import datetime, timezone
from flask import Flask, request, abort, jsonify

SECRET = os.environ["MOMENU_WEBHOOK_SECRET"].encode()
app = Flask(__name__)

@app.post("/webhook/momenu")
def momenu_webhook():
    raw = request.get_data()  # corpo bruto (bytes)
    timestamp = request.headers.get("x-webhook-timestamp", "")
    signature = request.headers.get("x-webhook-signature", "").lower()

    try:
        sent_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        abort(401)
    if abs((datetime.now(timezone.utc) - sent_at).total_seconds()) > 300:
        abort(401)

    expected = hmac.new(SECRET, timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        abort(401)

    event = json.loads(raw)
    webhook_id = request.headers.get("x-webhook-id")
    # ... idempotência por webhook_id, actualizar a encomenda ...
    return jsonify(received=True), 200
VERIFICAÇÃO - PHP
WEBHOOK ASSINADO
📋 Copiar
<?php
$secret    = getenv('MOMENU_WEBHOOK_SECRET');
$raw       = file_get_contents('php://input'); // corpo bruto
$timestamp = $_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? '';
$signature = strtolower($_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '');

$sentAt = strtotime($timestamp);
if ($sentAt === false || abs(time() - $sentAt) > 300) {
    http_response_code(401); exit;
}

$expected = hash_hmac('sha256', $timestamp . '.' . $raw, $secret);
if (!hash_equals($expected, $signature)) {
    http_response_code(401); exit;
}

$event     = json_decode($raw, true);
$webhookId = $_SERVER['HTTP_X_WEBHOOK_ID'] ?? '';
// ... idempotência por $webhookId, actualizar a encomenda ...
http_response_code(200);
echo json_encode(['received' => true]);
💡
Migrar do segredo literal: se hoje compara o x-webhook-secret, passe a verificar a assinatura como acima e, depois de publicar, active "Assinatura apenas" em Desenvolvedores. As duas formas funcionam em paralelo durante a transição — nada deixa de ser enviado até activar a opção. O plugin WordPress MoMenu Payments verifica a assinatura a partir da versão 1.4.0.
⚠
Guarde o segredo só no servidor (variável de ambiente ou cofre de segredos). Nunca o coloque em código de browser, apps móveis ou no URL do webhook. Se suspeitar que foi exposto, gere um novo em Desenvolvedores e actualize o seu servidor. Durante a troca, aceite os dois segredos (o novo e o anterior) por alguns dias: o segredo e a opção "Assinatura apenas" ficam associados a cada pagamento no momento em que é criado, por isso uma referência criada antes da troca e paga depois chega assinada com o segredo anterior. Os reenvios manuais (Desenvolvedores → Webhooks) são sempre assinados com o segredo configurado no momento do reenvio.
GET Estado do pagamento
Lê o estado que a order já tem. O :id é o transactionId devolvido na criação. A rota não confirma o pagamento e não contacta o gateway: quem marca a order como paga é o webhook (ou o Multicaixa Express confirmado na resposta). Uma chamada quando quer saber o estado. Não é uma sonda em ciclo.

REQUEST
📋 Copiar
curl -X GET "https://api.momenu.online/api/payment/status/ab12cd34ef56" \
  -H "x-api-key: SUA_API_KEY"
RESPONSE 200 — EM ABERTO
{
  "success": true,
  "transactionId": "ab12cd34ef56",
  "status": "open",
  "paymentMethod": "Referência Bancária",
  "amount": 2500
}
RESPONSE 200 — PAGO
{
  "success": true,
  "transactionId": "ab12cd34ef56",
  "status": "paid",
  "paymentMethod": "Referência Bancária",
  "amount": 2500,
  "paidAt": "2026-09-29T12:00:00.000Z",
  "invoiceUrl": "https://invoice-momenu.toquemedia.net/invoices/..."
}
💡
Estados: open ainda espera o callback, paid já foi confirmado, failed o callback fechou sem pagamento. Em failed pode vir failureReason (código curto do callback, por exemplo 3002). invoiceUrl e paidAt só aparecem quando está pago e a factura existe. Se o pagamento foi criado com split: true, a resposta inclui split (o estado do repasse: pending, processing, completed, partial, failed). Order de outro comerciante, ou em falta, responde 404 NOT_FOUND. Uma falha de leitura da base de dados responde 500, não 404.
Ambiente de Testes (QA)
