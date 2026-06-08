export function normalizeBigInt(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(normalizeBigInt);
  }

  if (typeof obj === 'bigint') {
    return Number(obj); // ou String(obj) se os valores forem muito grandes
  }

  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = normalizeBigInt(obj[key]);
    }
    return newObj;
  }

  return obj;
}
