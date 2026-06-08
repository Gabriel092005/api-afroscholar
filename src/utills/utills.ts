import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'



export function formatarTempoRelativo(data: Date | string) {
  return formatDistanceToNow(new Date(data), {
    addSuffix: true,
    locale: ptBR,
  })
}
export function isNewBot(createdAt: Date): boolean {
  const daysLimit = 7;
  const diffInMs = new Date().getTime() - createdAt.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  
  return diffInDays <= daysLimit;
}