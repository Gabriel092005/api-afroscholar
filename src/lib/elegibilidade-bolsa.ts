export type BolsaParaElegibilidade = {
  nivel?: string | null;
  requisitos?: string | null;
  idioma?: string | null;
};

export type PerfilParaElegibilidade = {
  nivelEnsino?: string | null;
  nivel?: string | null;
  media?: string | null;
  dataNascimento?: string | null;
  nacionalidade?: string | null;
  idiomas?: string | null;
  certificadosIdiomas?: string | null;
};

const NACIONALIDADES = ["angolan", "mocambican", "brasileir", "cabo-verdian", "cabo verdian", "portugues", "guineens", "santomens"];
const IDIOMAS = ["ingles", "frances", "portugues", "espanhol", "alemao", "japones", "mandarim", "chines", "italiano", "russo", "arabe", "coreano"];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/_/g, " ")
    .toLowerCase();
}

function primeiroNumero(texto: string): number | null {
  const encontrado = texto.match(/\d+(?:[.,]\d+)?/);
  return encontrado ? parseFloat(encontrado[0].replace(",", ".")) : null;
}

/** Posição na sequência de estudos; "pós-graduação" é ambígua e fica de fora. */
function ordemDoNivel(texto: string): number | null {
  const nivel = normalizar(texto);
  if (/pos[\s-]?doc/.test(nivel)) return 4;
  if (/pos[\s-]?gradua/.test(nivel)) return null;
  if (nivel.includes("doutor")) return 3;
  if (nivel.includes("mestrado")) return 2;
  if (/gradua|licenciatura/.test(nivel)) return 1;
  if (nivel.includes("ensino medio")) return 0;
  return null;
}

function cumpreNivel(nivelDaBolsa: string, perfil: PerfilParaElegibilidade): boolean | null {
  const aceites = nivelDaBolsa
    .split(",")
    .map(ordemDoNivel)
    .filter((ordem): ordem is number => ordem !== null);
  if (aceites.length === 0) return null;

  const atual = perfil.nivelEnsino ? ordemDoNivel(perfil.nivelEnsino) : null;
  if (atual === null) return false;
  // Quem concluiu um nível pode candidatar-se ao seguinte.
  return aceites.some((ordem) => ordem === atual || (ordem === atual + 1 && perfil.nivel === "CONCLUIDO"));
}

function idadeEm(dataNascimento: string, hoje: Date): number | null {
  const iso = dataNascimento.trim().replace(/^(\d{2})[/-](\d{2})[/-](\d{4})/, "$3-$2-$1");
  const nascimento = new Date(iso);
  if (Number.isNaN(nascimento.getTime())) return null;
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aniversarioPorVir =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aniversarioPorVir) idade -= 1;
  return idade;
}

/** Trecho do requisito depois da expressão encontrada, até à vírgula ou fim da linha. */
function trechoDepois(texto: string, expressao: RegExp): string | null {
  const encontrado = expressao.exec(texto);
  if (!encontrado) return null;
  return texto.slice(encontrado.index + encontrado[0].length).split(/[,;\n]/)[0];
}

function requisitoDeExame(texto: string, certificados: string): boolean[] {
  const resultados: boolean[] = [];
  for (const exame of ["ielts", "toefl"]) {
    if (!texto.includes(exame)) continue;
    const exigido = texto.match(new RegExp(`${exame}[^\\d,\\n]{0,12}(\\d+(?:[.,]\\d+)?)`));
    const obtido = certificados.match(new RegExp(`${exame}[^\\d\\n]{0,15}(\\d+(?:[.,]\\d+)?)`));
    if (!certificados.includes(exame)) resultados.push(false);
    else if (!exigido) resultados.push(true);
    else resultados.push(!!obtido && parseFloat(obtido[1].replace(",", ".")) >= parseFloat(exigido[1].replace(",", ".")));
  }
  return resultados;
}

/**
 * Compara o perfil com o que dá para verificar nos requisitos: nível, média, idade,
 * nacionalidade, idiomas e exames. Exige pelo menos um critério verificável, e um dado
 * em falta no perfil conta como não confirmado. Requisitos como cartas ou projetos não
 * são avaliados.
 */
export function cumpreRequisitosVerificaveis(
  bolsa: BolsaParaElegibilidade,
  perfil: PerfilParaElegibilidade | null | undefined,
  hoje: Date = new Date(),
): boolean {
  if (!perfil) return false;

  const verificacoes: boolean[] = [];
  const requisitos = normalizar(bolsa.requisitos ?? "");
  const idiomasDoPerfil = normalizar(perfil.idiomas ?? "");

  if (bolsa.nivel) {
    const nivel = cumpreNivel(bolsa.nivel, perfil);
    if (nivel !== null) verificacoes.push(nivel);
  }

  const mediaExigida = requisitos.match(/media(?:\s+minima)?(?:\s+de)?\s*:?\s*(\d{1,2}(?:[.,]\d+)?)/);
  if (mediaExigida) {
    const minimo = parseFloat(mediaExigida[1].replace(",", "."));
    const media = perfil.media ? primeiroNumero(perfil.media) : null;
    // As médias do perfil estão na escala de 0 a 20; um mínimo até 4 é de outra escala.
    verificacoes.push(minimo > 4 && media !== null && media >= minimo);
  }

  const idade = perfil.dataNascimento ? idadeEm(perfil.dataNascimento, hoje) : null;
  const limitesDeIdade: Array<[RegExp, (idade: number, limite: number) => boolean]> = [
    [/menos de (\d{2}) anos/, (i, l) => i < l],
    [/(?:ate|maximo de) (\d{2}) anos/, (i, l) => i <= l],
    [/idade maxima(?: de)?:?\s*(\d{2})/, (i, l) => i <= l],
    [/(?:maior(?:es)? de) (\d{2}) anos/, (i, l) => i >= l],
    [/idade minima(?: de)?:?\s*(\d{2})/, (i, l) => i >= l],
  ];
  for (const [expressao, cumpre] of limitesDeIdade) {
    const limite = requisitos.match(expressao);
    if (limite) verificacoes.push(idade !== null && cumpre(idade, Number(limite[1])));
  }

  const trechoNacionalidade = trechoDepois(requisitos, /\b(?:ser|nacionalidade|cidadaos?)\s+(?:de\s+)?(?=angolan|mocambican|brasileir|cabo[\s-]verdian|portugues|guineens|santomens)/);
  if (trechoNacionalidade !== null) {
    const nacionalidade = normalizar(perfil.nacionalidade ?? "");
    const aceites = NACIONALIDADES.filter((n) => trechoNacionalidade.includes(n));
    verificacoes.push(aceites.some((n) => nacionalidade.includes(n)));
  }

  const trechoIdioma = trechoDepois(requisitos, /\b(?:dominio|fluencia|proficiencia|conhecimento)\s+(?:(?:de|em|do|da|dos|das)\s+)?/);
  if (trechoIdioma !== null) {
    const aceites = IDIOMAS.filter((i) => trechoIdioma.includes(i));
    if (aceites.length > 0) verificacoes.push(aceites.some((i) => idiomasDoPerfil.includes(i)));
  }

  if (bolsa.idioma) {
    const idiomaDaBolsa = normalizar(bolsa.idioma);
    const aceites = IDIOMAS.filter((i) => idiomaDaBolsa.includes(i));
    if (aceites.length > 0) verificacoes.push(aceites.some((i) => idiomasDoPerfil.includes(i)));
  }

  verificacoes.push(...requisitoDeExame(requisitos, normalizar(perfil.certificadosIdiomas ?? "")));

  return verificacoes.length > 0 && verificacoes.every(Boolean);
}
