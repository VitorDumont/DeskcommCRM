/**
 * O TEMPLATE MOSTRA TODA VARIÁVEL QUE O SCHEMA CONHECE.
 *
 * `docs/current-state.md` §4.5 registrou a divergência: variáveis declaradas em
 * `lib/env.ts` e ausentes do template. O custo não é a instalação quebrar — as
 * ausentes têm default —, é o operador não ter como saber que elas existem. A
 * primeira notícia de um knob não pode ser o momento em que se precisa dele, e
 * uma delas é de segurança (`WAHA_WEBHOOK_REQUIRE_SIGNATURE`).
 *
 * Medido quando este teste nasceu: 10 ausentes no `.env.hostgator.example`, que
 * é JUSTAMENTE o que o `install.sh` copia para a VPS do cliente.
 *
 * Este arquivo troca a afirmação de estado por um comando, que é o que o
 * CLAUDE.md pede: "onde a afirmação puder virar comando, troque em vez de
 * corrigir — um número corrigido envelhece de novo".
 *
 * O teste conta COMENTADA como presente: `# FOO=` documenta a variável sem
 * forçar valor, que é o jeito certo de mostrar um opcional.
 *
 * ## Por que não basta o `env-example-sync.test.ts` que já existia
 *
 * Aquele cobre só o `.env.example` e exige a chave DESCOMENTADA. São duas
 * lacunas, e a divergência de 10 variáveis morava exatamente nelas: o arquivo
 * que o `install.sh` copia para a VPS é o `.env.hostgator.example`, e ninguém
 * o comparava com o schema. Os dois testes convivem porque medem coisas
 * diferentes — aquele garante que o template de DEV traz a chave pronta para
 * preencher; este, que nenhum dos dois esconde uma variável que existe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

/**
 * `NODE_ENV` vem do AMBIENTE (o Node o define, o Docker o define), nunca do
 * arquivo do operador. Pedir que ele apareça no template convidaria alguém a
 * fixá-lo ali, e `NODE_ENV=development` num `.env` de produção é um estrago
 * silencioso.
 */
const FORA_DO_TEMPLATE = new Set(["NODE_ENV"]);

function declaradasNoSchema(): string[] {
  const src = readFileSync(join(RAIZ, "lib/env.ts"), "utf8");
  return [...new Set(src.match(/^\s{2}[A-Z][A-Z0-9_]{2,}:\s*z\./gm) ?? [])]
    .map((l) => l.trim().split(":")[0]!)
    .filter((v) => !FORA_DO_TEMPLATE.has(v));
}

function presentesNoTemplate(arquivo: string): Set<string> {
  const src = readFileSync(join(RAIZ, arquivo), "utf8");
  return new Set((src.match(/^#?\s*[A-Z][A-Z0-9_]{2,}=/gm) ?? []).map((l) =>
    l.replace(/^#?\s*/, "").replace(/=$/, ""),
  ));
}

describe("o template de .env cobre o schema", () => {
  it("o instrumento está vivo: acha variáveis dos dois lados", () => {
    // Sem isto, um regex que parasse de casar deixaria o teste verde por não
    // achar nada dos dois lados — o falso verde por ausência de dado.
    expect(declaradasNoSchema().length, "nenhuma variável lida de lib/env.ts").toBeGreaterThan(20);
    expect(
      presentesNoTemplate(".env.hostgator.example").size,
      "nenhuma variável lida do template",
    ).toBeGreaterThan(20);
  });

  it.each([".env.example", ".env.hostgator.example"])(
    "%s mostra toda variável que lib/env.ts declara",
    (arquivo) => {
      const presentes = presentesNoTemplate(arquivo);
      const ausentes = declaradasNoSchema().filter((v) => !presentes.has(v));
      expect(
        ausentes,
        `variáveis que o schema conhece e ${arquivo} não mostra — o operador não ` +
          `descobre que existem até precisar delas:\n  ${ausentes.join("\n  ")}`,
      ).toEqual([]);
    },
  );
});
