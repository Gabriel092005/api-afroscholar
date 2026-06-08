
// export interface BotAsset {
//   id: string;
//   estado: "APRESENTACAO" | "TRABALHANDO" | "REPOUSANDO" | "CONVERSANDO" | "RELAXANDO";
//   video_path: string;
// }

// export interface BotDetailsResponse {
//   id: string; // botEmpresaId
//   botId: string;
//   empresaId: string;
//   departamentoId: string;
//   bot: {
//     nome: string;
//     funcao: string;
//     descricao: string;
//     assets: BotAsset[];
//     whatBotCanDos: { id: string; title: string }[];
//   };
//   empresa: {
//     nome: string;
//     logotipo: string | null;
//   };
// }

// export async function getBotEmpresaDetails(id: string): Promise<BotDetailsResponse> {
//   const response = await api(`/bot/bot/${id}`);
//   return response.data;
// }