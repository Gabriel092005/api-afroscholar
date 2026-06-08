import jwt from "jsonwebtoken";
import { env } from "@/Env";

export function generateJitsiToken(
  roomName: string,
  user: { nome: string; email: string; image_path?: string | null; id: string }
): string | null {
  if (!env.JITSI_APP_ID || !env.JITSI_KEY_ID || !env.JITSI_PRIVATE_KEY) {
    console.warn("[JITSI] Missing credentials (APP_ID, KEY_ID or PRIVATE_KEY)");
    return null;
  }

  const now = Math.round(Date.now() / 1000);

  const payload = {
    aud: "jitsi",
    context: {
      user: {
        id: user.id,
        name: user.nome,
        email: user.email,
        avatar: user.image_path || "",
        moderator: "true",
      },
      features: {
        livestreaming: "true",
        recording: "true",
        transcription: "true",
        "outbound-call": "true",
      },
    },
    iss: "chat",
    room: "*",
    sub: env.JITSI_APP_ID,
    exp: now + 10800,
    nbf: now - 10,
  };

  try {
    const privateKey = env.JITSI_PRIVATE_KEY.replace(/\\n/g, "\n");

    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      header: { kid: env.JITSI_KEY_ID },
    });

    console.log(`[JITSI] Token generated for room ${roomName} (user: ${user.nome})`);

    const decoded = jwt.decode(token) as Record<string, unknown>;
    console.log("[JITSI] Decoded payload:", JSON.stringify(decoded, null, 2));
    const header = jwt.decode(token, { complete: true }) as { header: Record<string, unknown> };
    console.log("[JITSI] Decoded header:", JSON.stringify(header?.header, null, 2));

    return token;
  } catch (err) {
    console.error("[JITSI] Error generating token:", err);
    return null;
  }
}
