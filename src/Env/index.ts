import dotenv from 'dotenv'
import path from 'node:path'

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.dev') })
}

import { z } from 'zod'

const envSchema =  z.object ({
    NODE_ENV : z.enum(['dev','test','production']) .default('dev'),
    JWT_SECRET: z.string(),
    DATABASE_URL:z.string().url(),
    API_URL: z.string().default("http://localhost:3333"),
    FRONTEND_URL: z.string().default("https://afroscholars.academy"),
    PORT: z.coerce.number().default(3333),
    OPENAI_API_KEY: z.string().optional().default(""),
    OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    OPENAI_TIMEOUT: z.coerce.number().default(30000),
    OPENAI_MAX_TOKENS: z.coerce.number().default(1024),
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    EMAIL_FROM: z.string().default(""),
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    GOOGLE_CALLBACK_URL: z.string().default(""),
    VAPID_PUBLIC_KEY: z.string().default("BFNPdsaGGPaoeVfEDOCuOUnuZm2uJzwwkBztcsJdda31FTKd2QNyaYlrYhQkFRRTw6FXydes6NKe3oxJH4XVHok"),
    VAPID_PRIVATE_KEY: z.string().default("VsGujun0euJTJYttHuM9TksoP57Q72I4Iqk_RZGFGag"),
    JITSI_APP_ID: z.string().default(""),
    JITSI_KEY_ID: z.string().default(""),
    JITSI_PRIVATE_KEY: z.string().default(""),
})

const _env = envSchema.safeParse(process.env)

if(_env.success === false){

    console.error(' ❌Invalid enviroment variables',_env.error.format())
    throw new Error('Invalid enviroment variables.')
}

const envData = _env.data

if (!envData.GOOGLE_CALLBACK_URL) {
  envData.GOOGLE_CALLBACK_URL = `${envData.API_URL}/auth/google/callback`
}

const derivedCallbackUrl = `${envData.API_URL}/auth/google/callback`

if (envData.NODE_ENV === 'production') {
  if (envData.GOOGLE_CALLBACK_URL.includes('localhost')) {
    console.error(' ❌GOOGLE_CALLBACK_URL aponta para localhost em produção! Configure a URL correta no .env')
  }
  if (envData.FRONTEND_URL.includes('localhost')) {
    console.error(' ❌FRONTEND_URL aponta para localhost em produção! Configure a URL correta no .env')
  }
  if (envData.GOOGLE_CALLBACK_URL && envData.GOOGLE_CALLBACK_URL !== derivedCallbackUrl) {
    console.warn(
      ' ⚠️ GOOGLE_CALLBACK_URL no .env difere do valor auto-derivado de API_URL.\n' +
      `    .env:        ${envData.GOOGLE_CALLBACK_URL}\n` +
      `    auto-derivado: ${derivedCallbackUrl}\n` +
      '    Certifique-se de que o valor no Google Cloud Console corresponde ao usado.'
    )
  }
}

console.log(`🌐 [ENV] NODE_ENV=${envData.NODE_ENV} | FRONTEND_URL=${envData.FRONTEND_URL} | PORT=${envData.PORT}`)

export const env = envData
