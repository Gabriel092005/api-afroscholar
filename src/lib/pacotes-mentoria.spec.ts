import { describe, expect, it } from "vitest";
import { duracaoEmTexto, opcoesMentoria, pacotesFormularioSchema } from "./pacotes-mentoria";

describe("opcoesMentoria", () => {
  it("mantém o mês base e calcula os pacotes por ordem de duração", () => {
    const pacotes = [{ meses: 6, multiplicador: 4.5 }, { meses: 3, multiplicador: 2.5 }];
    expect(opcoesMentoria(10000, pacotes)).toEqual([
      { meses: 1, valor: 10000 },
      { meses: 3, valor: 25000 },
      { meses: 6, valor: 45000 },
    ]);
  });

  it("arredonda para kwanzas inteiros", () => {
    expect(opcoesMentoria(999, [{ meses: 3, multiplicador: 2.55 }])[1].valor).toBe(2547);
  });

  it("não vende pacotes de uma mentoria gratuita", () => {
    expect(opcoesMentoria(0, [{ meses: 3, multiplicador: 2 }])).toEqual([{ meses: 1, valor: 0 }]);
  });

  it("ignora configurações ausentes ou inválidas", () => {
    expect(opcoesMentoria(5000, null)).toEqual([{ meses: 1, valor: 5000 }]);
    expect(opcoesMentoria(5000, [{ meses: 3, multiplicador: 0.1 }])).toEqual([{ meses: 1, valor: 5000 }]);
  });
});

describe("pacotesFormularioSchema", () => {
  it("lê o JSON do formulário e aceita lista vazia", () => {
    expect(pacotesFormularioSchema.parse('[{"meses":3,"multiplicador":2.5}]')).toEqual([{ meses: 3, multiplicador: 2.5 }]);
    expect(pacotesFormularioSchema.parse("[]")).toEqual([]);
  });

  it.each([
    ["não é JSON"],
    ['[{"meses":1,"multiplicador":2}]'],
    ['[{"meses":3,"multiplicador":1}]'],
    ['[{"meses":3,"multiplicador":2},{"meses":3,"multiplicador":2.5}]'],
    ['[{"meses":3,"multiplicador":2},{"meses":6,"multiplicador":2}]'],
  ])("recusa %s", (texto) => {
    expect(pacotesFormularioSchema.safeParse(texto).success).toBe(false);
  });
});

describe("duracaoEmTexto", () => {
  it("usa singular e plural", () => {
    expect(duracaoEmTexto(1)).toBe("1 mês");
    expect(duracaoEmTexto(3)).toBe("3 meses");
  });
});
