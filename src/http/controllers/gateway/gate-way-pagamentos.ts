// import axios from 'axios';
// import * as crypto from 'crypto';
// const paternId = process.env.PATHERID ?? '123456';

// interface Props {
//   number: string;
//   total: string;
//   type: 'express' | 'reference';
// }

// export interface ExpressReturnType {
//   out_trade_no: string;
//   trade_no: string;
//   status: string;
//   trade_token: string;
// }

// function generateRandomString(length) {
//   return crypto
//     .randomBytes(Math.ceil(length / 2))
//     .toString('hex')
//     .slice(0, length);
// }

// function getCurrentTimestamp() {
//   const now = new Date();
//   return `${now.getFullYear()}-${(now.getMonth() + 1)
//     .toString()
//     .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now
//     .getHours()
//     .toString()
//     .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now
//     .getSeconds()
//     .toString()
//     .padStart(2, '0')}`;
// }

// function encryptAndBase64(data: string, privateKey: string) {
//   const buf = Buffer.from(data, 'utf8');

//   // chave de 1024 bits ⇒ 128 bytes; com PKCS1 v1.5 sobram 117 bytes úteis
//   const keySize = 128; // 1024 / 8
//   const maxChunk = keySize - 11;

//   const encryptedChunks: Buffer[] = [];
//   for (let offset = 0; offset < buf.length; offset += maxChunk) {
//     const slice = buf.slice(offset, offset + maxChunk);

//     const encrypted = crypto.privateEncrypt(
//       { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
//       slice,
//     );

//     encryptedChunks.push(encrypted);
//   }

//   return Buffer.concat(encryptedChunks).toString('base64');
// }

// function generateOutTradeNo(length = 24) {
//   return crypto
//     .randomBytes(Math.ceil(length / 2))
//     .toString('hex')
//     .slice(0, length);
// }
// const privateKey = process.env.PAYPAY_PRIVATE as string;

// export default async function createPayment(prop: Props): Promise<any> {
//   // Construct biz_content
//   const bizContentData = {
//     payer_ip: 'user_ip',
//     timeout_express: '10m',
//     sale_product_code: '050200030',
//     cashier_type: 'SDK',
//     out_trade_no: '012321', //your order number
//     subject: 'NublaPay Pagamento', //order name
//     currency: 'AOA',
//     price: parseFloat(prop.total), //order price
//     quantity: 1, //quantity
//     total_amount: parseFloat(prop.total), //total amount
//     payee_identity: '40404040404',
//     trade_info: {
//       currency: 'AOA',
//       out_trade_no: generateOutTradeNo(),
//       payee_identity: paternId,
//       payee_identity_type: '1',
//       price: parseFloat(prop.total),
//       quantity: '1',
//       subject: 'Catering expenses',
//       total_amount: parseFloat(prop.total),
//     },
//     pay_method: {
//       pay_product_code: '31',
//       amount: parseFloat(prop.total),
//       bank_code: 'MUL',
//       phone_num: ${prop.number},
//     },
//   };
//   function generateSignature(requestBody) {
//     // Sort the request body keys and concatenate them into a string
//     const sortedKeys = Object.keys(requestBody).sort();
//     const paramString = sortedKeys
//       .filter((key) => key !== 'sign' && key !== 'sign_type') // Exclude sign and sign_type parameters
//       .map((key) => ${key}=${requestBody[key]})
//       .join('&');

//     // Sign the string using the private key
//     // Replace with your actual private key
//     const sign = crypto.createSign('RSA-SHA1');
//     sign.update(paramString);
//     const signature = sign.sign(privateKey, 'base64');

//     // Set the signature and sign_type back to the request body
//     requestBody.sign = signature;
//     requestBody.sign_type = 'RSA';

//     return signature;
//   }
//   // Encrypt and base64 encode biz_content
//   const encryptedBizContent = encryptAndBase64(
//     JSON.stringify(bizContentData),
//     privateKey,
//   );

//   // Construct the request body
//   const requestBody = {
//     request_no: generateRandomString(32),
//     service: 'instant_trade',
//     version: '1.0',
//     partner_id: paternId,
//     charset: 'UTF-8',
//     language: 'pt',
//     sign_type: 'RSA',
//     timestamp: getCurrentTimestamp(),
//     format: 'JSON',
//     biz_content: encryptedBizContent,
//   };

//   // Generate the signature
//   generateSignature(requestBody);

//   // URL encode all values in the request body
//   for (const key in requestBody) {
//     if (
//       requestBody.hasOwnProperty(key) &&
//       key !== 'sign' &&
//       key !== 'sign_type'
//     ) {
//       requestBody[key] = encodeURIComponent(requestBody[key]);
//     }
//   }

//   // Convert to JSON string
//   const requestBodyString = JSON.stringify(requestBody);

//   // Send the request

//   // Convert to JSON string
//   const response = await axios.post(
//     'https://gateway.paypayafrica.com/recv.do',
//     requestBody, // envie o objeto, não a string
//     {
//       headers: { 'Content-Type': 'application/json' },
//     },
//   );
//   const data = response.data?.biz_content as ExpressReturnType;
//   console.log(response.data);
//   return data;
// }

// export interface ReferenceReturnType {
//   out_trade_no: string;
//   reference_id: string;
//   trade_no: string;
//   entity_id: string;
//   status: string;
//   trade_token: string;
//   dynamic_link: string;
// }

// export async function createReferencePayment(prop: {
//   total: string;
// }): Promise<ReferenceReturnType> {
//   function generateSignature(requestBody) {
//     // Sort the request body keys and concatenate them into a string
//     const sortedKeys = Object.keys(requestBody).sort();
//     const paramString = sortedKeys
//       .filter((key) => key !== 'sign' && key !== 'sign_type') // Exclude sign and sign_type parameters
//       .map((key) => ${key}=${requestBody[key]})
//       .join('&');

//     // Sign the string using the private key
//     // Replace with your actual private key
//     const sign = crypto.createSign('RSA-SHA1');
//     sign.update(paramString);
//     const signature = sign.sign(privateKey, 'base64');

//     // Set the signature and sign_type back to the request body
//     requestBody.sign = signature;
//     requestBody.sign_type = 'RSA';

//     return signature;
//   }
//   // Construct biz_content
//   const bizContentData = {
//     payer_ip: 'user_ip',
//     timeout_express: '10m',
//     sale_product_code: '050200030',
//     cashier_type: 'SDK',
//     out_trade_no: '012321', //your order number
//     subject: 'NublaPa Pagamento', //order name
//     currency: 'AOA',
//     price: parseFloat(prop.total), //order price
//     quantity: 1, //quantity
//     total_amount: parseFloat(prop.total), //total amount
//     payee_identity: '40404040404',
//     trade_info: {
//       currency: 'AOA',
//       out_trade_no: generateOutTradeNo(),
//       payee_identity: paternId,
//       payee_identity_type: '1',
//       price: parseFloat(prop.total),
//       quantity: '1',
//       subject: 'Catering expenses',
//       total_amount: parseFloat(prop.total),
//     },
//     pay_method: {
//       pay_product_code: '31',
//       amount: parseFloat(prop.total),
//       bank_code: 'REF',
//     },
//   };

//   // Encrypt and base64 encode biz_content
//   const encryptedBizContent = encryptAndBase64(
//     JSON.stringify(bizContentData),
//     privateKey,
//   );
//   const requestBody = {
//     request_no: generateRandomString(32),
//     service: 'instant_trade',
//     version: '1.0',
//     partner_id: paternId,
//     charset: 'UTF-8',
//     language: 'pt',
//     sign_type: 'RSA',
//     timestamp: getCurrentTimestamp(),
//     format: 'JSON',
//     biz_content: encryptedBizContent,
//   };

//   generateSignature(requestBody);

//   // URL encode all values in the request body
//   for (const key in requestBody) {
//     if (
//       requestBody.hasOwnProperty(key) &&
//       key !== 'sign' &&
//       key !== 'sign_type'
//     ) {
//       requestBody[key] = encodeURIComponent(requestBody[key]);
//     }
//   }

//   // Convert to JSON string
//   const response = await axios.post(
//     'https://gateway.paypayafrica.com/recv.do',
//     requestBody, // envie o objeto, não a string
//     {
//       headers: { 'Content-Type': 'application/json' },
//     },
//   );
//   console.log(response.data);
//   const data: ReferenceReturnType = response.data?.biz_content;
//   return data;
// }

// export interface TrasnferReturnType {
//   out_trade_no: string;
//   trade_no: string;
//   status: 'S' | 'F' | 'P';
// }

// export async function transFerMoney(prop: {
//   iban: string;
//   total: string;
//   bank: string;
//   username: string;
// }): Promise<TrasnferReturnType> {
//   function generateSignature(requestBody) {
//     // Sort the request body keys and concatenate them into a string
//     const sortedKeys = Object.keys(requestBody).sort();
//     const paramString = sortedKeys
//       .filter((key) => key !== 'sign' && key !== 'sign_type') // Exclude sign and sign_type parameters
//       .map((key) => ${key}=${requestBody[key]})
//       .join('&');

//     // Sign the string using the private key
//     // Replace with your actual private key
//     const sign = crypto.createSign('RSA-SHA1');
//     sign.update(paramString);
//     const signature = sign.sign(privateKey, 'base64');

//     // Set the signature and sign_type back to the request body
//     requestBody.sign = signature;
//     requestBody.sign_type = 'RSA';

//     return signature;
//   }
//   // Construct biz_content
//   const bizContentData = {
//     payer_identity_type: '1',
//     out_trade_no: '012321',
//     payer_identity: paternId,
//     amount: parseFloat(prop.total),
//     currency: 'AOA',
//     bank_card_no: prop.iban,
//     bank_account_name: prop.username,
//     bank_code: prop.bank,
//     sale_product_code: '050200030',
//     pay_product_code: '11',
//     memo: 'Test',
//   };

//   // Encrypt and base64 encode biz_content
//   const encryptedBizContent = encryptAndBase64(
//     JSON.stringify(bizContentData),
//     privateKey,
//   );

//   const requestBody = {
//     request_no: generateRandomString(32),
//     service: 'transfer_to_card',
//     version: '1.0',
//     partner_id: paternId,
//     charset: 'UTF-8',
//     language: 'pt',
//     sign_type: 'RSA',
//     timestamp: getCurrentTimestamp(),
//     format: 'JSON',
//     biz_content: encryptedBizContent,
//   };

//   generateSignature(requestBody);

//   // URL encode all values in the request body
//   for (const key in requestBody) {
//     if (
//       requestBody.hasOwnProperty(key) &&
//       key !== 'sign' &&
//       key !== 'sign_type'
//     ) {
//       requestBody[key] = encodeURIComponent(requestBody[key]);
//     }
//   }

//   // Convert to JSON string
//   const response = await axios.post(
//     'https://gateway.paypayafrica.com/recv.do',
//     requestBody, // envie o objeto, não a string
//     {
//       headers: { 'Content-Type': 'application/json' },
//     },
//   );
//   const data = response.data?.biz_content as TrasnferReturnType;
//   console.log(response.data);
//   return data;
// }
// gateway.paypayafrica.com

