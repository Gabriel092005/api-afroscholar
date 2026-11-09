import { describe, expect, it } from "vitest";
import { cumpreRequisitosVerificaveis as cumpre } from "./elegibilidade-bolsa";

const hoje = new Date("2026-11-09T12:00:00Z");

describe("cumpreRequisitosVerificaveis", () => {
  it("aceita quem está no nível e tem a média mínima", () => {
    const bolsa = { nivel: "GRADUACAO", requisitos: "Ser angolano, média mínima 15 valores" };
    const perfil = { nivelEnsino: "GRADUACAO", media: "16 valores", nacionalidade: "Angolana" };
    expect(cumpre(bolsa, perfil, hoje)).toBe(true);
  });

  it("recusa média abaixo do mínimo", () => {
    const bolsa = { requisitos: "Média mínima de 16 valores, carta de motivação" };
    expect(cumpre(bolsa, { media: "14 valores" }, hoje)).toBe(false);
  });

  it("aceita quem concluiu o nível anterior, mas não quem ainda o frequenta", () => {
    const bolsa = { nivel: "Mestrado" };
    expect(cumpre(bolsa, { nivelEnsino: "GRADUACAO", nivel: "CONCLUIDO" }, hoje)).toBe(true);
    expect(cumpre(bolsa, { nivelEnsino: "GRADUACAO", nivel: "3_ANO" }, hoje)).toBe(false);
  });

  it("aceita qualquer um dos níveis listados pelo administrador", () => {
    expect(cumpre({ nivel: "Graduação, Mestrado" }, { nivelEnsino: "MESTRADO" }, hoje)).toBe(true);
  });

  it("não confirma quando falta um dado no perfil", () => {
    const bolsa = { nivel: "GRADUACAO", requisitos: "média mínima 14 valores" };
    expect(cumpre(bolsa, { nivelEnsino: "GRADUACAO" }, hoje)).toBe(false);
    expect(cumpre(bolsa, null, hoje)).toBe(false);
  });

  it("não confirma quando nada é verificável", () => {
    expect(cumpre({ requisitos: "Carta de motivação" }, { nivelEnsino: "MESTRADO" }, hoje)).toBe(false);
  });

  it("verifica o limite de idade antes e depois do aniversário", () => {
    const bolsa = { requisitos: "Menos de 35 anos" };
    expect(cumpre(bolsa, { dataNascimento: "1991-12-01" }, hoje)).toBe(true);
    expect(cumpre(bolsa, { dataNascimento: "1991-11-01" }, hoje)).toBe(false);
    expect(cumpre(bolsa, { dataNascimento: "01/12/1991" }, hoje)).toBe(true);
  });

  it("aceita um dos idiomas pedidos", () => {
    const bolsa = { requisitos: "Domínio do inglês ou japonês, projeto de pesquisa" };
    expect(cumpre(bolsa, { idiomas: "Português (nativo), Japonês (avançado)" }, hoje)).toBe(true);
    expect(cumpre(bolsa, { idiomas: "Português (nativo)" }, hoje)).toBe(false);
  });

  it("compara a nota do exame de idioma", () => {
    const bolsa = { requisitos: "IELTS 7.0+, proposta de pesquisa" };
    expect(cumpre(bolsa, { certificadosIdiomas: "IELTS: 7.5" }, hoje)).toBe(true);
    expect(cumpre(bolsa, { certificadosIdiomas: "IELTS: 6.5" }, hoje)).toBe(false);
    expect(cumpre(bolsa, { certificadosIdiomas: "" }, hoje)).toBe(false);
  });

  it("não confunde o idioma português com a nacionalidade", () => {
    const bolsa = { requisitos: "Ser fluente, domínio do português" };
    expect(cumpre(bolsa, { idiomas: "Português", nacionalidade: "Angolana" }, hoje)).toBe(true);
  });
});
