/**
 * O `\n` que o modelo escreveu como TEXTO vira quebra de linha de verdade.
 *
 * ## O defeito, medido
 *
 * Mensagem entregue a um cliente no WhatsApp em 2026-09-12, gravada assim em
 * `messages.body` e assim exibida no aparelho dele:
 *
 *   "Oi Vitor! Desculpa mesmo a espera.\n\nA equipe que cuida do processo…"
 *
 * Os `\n` são dois caracteres — barra e ene —, não quebras. Não é defeito de
 * renderização: o texto chegou assim do modelo e ninguém o normalizou no
 * caminho. Modelos menores (e os `:free`) fazem isso com frequência, porque
 * treinaram vendo JSON escapado e reproduzem o escape dentro do valor.
 *
 * ## Por que não é só cosmético
 *
 * `splitIntoBubbles` separa parágrafos por `/\n{2,}/` — quebra REAL. Com o
 * escape literal a resposta não casa com o separador, e o que deveria virar
 * duas ou três bolhas curtas sai como um bloco único, longo, com `\n` à mostra.
 * O defeito de formatação come junto a divisão em bolhas, que é a feição
 * anti-banimento do envio.
 *
 * ## O limite desta função, dito com todas as letras
 *
 * Ela converte a sequência em QUALQUER posição do texto, inclusive dentro de um
 * bloco de código, onde um `\n` literal poderia ser intencional. Isso é uma
 * troca consciente: este texto é uma mensagem de WhatsApp de atendimento, e a
 * chance de alguém querer exibir a sequência crua ao cliente é muito menor que
 * a de o modelo tê-la escrito por engano. Se um dia o produto mandar snippet de
 * código ao cliente, esta é a primeira linha a revisar.
 */

/**
 * `\r\n` antes de `\n`: fazer o contrário deixaria um `\r` literal órfão para
 * trás, que não aparece na tela e reaparece no banco.
 */
export function normalizarQuebrasLiterais(texto: string): string {
  if (typeof texto !== "string" || texto === "") return texto;
  if (!texto.includes("\\")) return texto;
  return texto
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}
