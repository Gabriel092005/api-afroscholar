import "fastify";
import { WebSocket } from "ws"; // Importando o tipo de WebSocket do pacote `ws`

declare module "fastify" {
  interface FastifyInstance {
    websocket: {
      on(event: "connection", listener: (socket: WebSocket) => void): void;
    };
  }
}
