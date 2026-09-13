/**
 * NENHUM SEGREDO ENTRA NO REPOSITÓRIO.
 *
 * `docs/current-state.md` §4.7 registra o buraco: não há gitleaks no CI nem
 * pre-commit hook, e a única camada é o `.gitignore` cobrir `.env*`. Isso
 * protege do arquivo inteiro e não protege de uma chave COLADA dentro de um
 * arquivo versionado — num script de exemplo, num teste, num runbook —, que é
 * como segredo vaza de verdade em repositório público.
 *
 * Este teste é a camada que faltava, e mora aqui em vez de numa action de
 * terceiro de propósito: roda no `verify` que já existe, não acrescenta
 * dependência à cadeia de CI e é executável localmente por quem escreve —
 * `pnpm exec vitest run tests/unit/nenhum-segredo-versionado.test.ts` responde
 * antes do push, que é quando o conserto ainda é barato. Depois do push, um
 * segredo já vazou mesmo que o commit seja removido.
 *
 * Varre o que o git RASTREIA (`git ls-files`), não o disco: `.env` real,
 * `node_modules` e artefato de build ficam de fora sem precisar de lista.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

/**
 * Os padrões são de PREFIXO EMITIDO POR PROVEDOR, não heurística de entropia.
 * Entropia dá falso positivo em hash, em chave pública e em fixture — e um
 * gate que grita à toa é desligado antes de pegar o caso real.
 */
const PADROES: Array<{ nome: string; rx: RegExp }> = [
  { nome: "OpenAI/OpenRouter", rx: /\bsk-(?:or-v1-|proj-|ant-)?[A-Za-z0-9_-]{24,}/ },
  { nome: "Resend", rx: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/ },
  { nome: "GitHub token", rx: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/ },
  { nome: "AWS access key", rx: /\bAKIA[0-9A-Z]{16}\b/ },
  { nome: "Anthropic", rx: /\bsk-ant-api[0-9]{2}-[A-Za-z0-9_-]{32,}/ },
  { nome: "Google API key", rx: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { nome: "Slack token", rx: /\bxox[abprs]-[0-9A-Za-z-]{10,}/ },
  { nome: "chave privada PEM", rx: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  // JWT com corpo longo: a anon/service_role do Supabase tem esta cara. O teto
  // de tamanho evita casar com `eyJ` de um JSON base64 curto qualquer.
  { nome: "JWT (anon/service_role)", rx: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}/ },
];

/**
 * O que pode conter algo com CARA de segredo sem ser um.
 *
 * A lista é de ARQUIVO, nunca de padrão: desligar um padrão inteiro para calar
 * um arquivo deixaria o repo sem aquela proteção em todos os outros.
 */
const ISENTOS = new Set<string>([
  // Este arquivo: os próprios padrões e o segredo de mentira do caso de teste.
  "tests/unit/nenhum-segredo-versionado.test.ts",
  // JWT de exemplo, com assinatura literal `abcdefghijklmnop…`. O teste existe
  // para provar que a função reconhece o FORMATO legado do Supabase; um valor
  // real ali não acrescentaria nada ao que ele mede.
  "lib/audit/service-role-configured.test.ts",
  // A `service_role` do Supabase LOCAL (`"iss":"supabase-demo"` no payload). É
  // a mesma em toda instalação do CLI, está na documentação pública e só vale
  // contra 127.0.0.1:54321 — não há o que revogar.
  "tests/sonda-radar-isolamento-orgs.ts",
  // `sk-CHAVE-QUE-NUNCA-PODE-VAZAR-…`: a sentinela que aquele teste planta de
  // propósito para provar que a chave não aparece em log de erro. O nome dela
  // diz o que ela é.
  "tests/unit/llm-calls-registra-falha.test.ts",
]);

/** Linha que se declara exemplo não é vazamento — é documentação. */
const MARCAS_DE_EXEMPLO =
  /(exemplo|example|placeholder|fake|dummy|de mentira|sua[-_ ]chave|your[-_ ]key|xxx|\.{3}|…|<[a-z_-]+>|SEU_|COLE_)/i;

function arquivosRastreados(): string[] {
  const saida = execFileSync("git", ["ls-files", "-z"], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 });
  return saida.toString("utf8").split("\0").filter(Boolean);
}

function ehTexto(caminho: string): boolean {
  if (/\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|eot|mp4|mp3|zip|gz|tgz|wasm)$/i.test(caminho)) {
    return false;
  }
  try {
    // Arquivo enorme não é lugar de chave colada e custa caro para varrer.
    return statSync(join(RAIZ, caminho)).size <= 2 * 1024 * 1024;
  } catch {
    return false;
  }
}

function achados(): string[] {
  const fora: string[] = [];
  for (const arq of arquivosRastreados()) {
    if (ISENTOS.has(arq) || !ehTexto(arq)) continue;
    let conteudo: string;
    try {
      conteudo = readFileSync(join(RAIZ, arq), "utf8");
    } catch {
      continue;
    }
    const linhas = conteudo.split("\n");
    for (let i = 0; i < linhas.length; i += 1) {
      const linha = linhas[i] ?? "";
      if (linha.length > 4000) continue;
      for (const { nome, rx } of PADROES) {
        if (!rx.test(linha)) continue;
        if (MARCAS_DE_EXEMPLO.test(linha)) continue;
        fora.push(`${arq}:${i + 1} → ${nome}`);
      }
    }
  }
  return fora;
}

describe("nenhum segredo versionado", () => {
  it("o instrumento está vivo: lê os arquivos do git e reconhece um segredo", () => {
    // Sem esta guarda, um `git ls-files` que devolvesse vazio deixaria o teste
    // verde por ausência de dado — o falso verde que o CLAUDE.md nomeia.
    expect(arquivosRastreados().length, "git ls-files não devolveu arquivo nenhum").toBeGreaterThan(
      100,
    );
    const chaveDeMentira = `re_${"A".repeat(10)}_${"B".repeat(20)}`;
    expect(
      PADROES.some((p) => p.rx.test(chaveDeMentira)),
      "os padrões deixaram de reconhecer uma chave com formato de provedor",
    ).toBe(true);
  });

  it("a isenção é de ARQUIVO, e o marcador de exemplo não apaga um padrão", () => {
    // Um `.env.example` com `RESEND_API_KEY="re_sua-chave-aqui"` não é vazamento.
    expect(MARCAS_DE_EXEMPLO.test('RESEND_API_KEY="re_sua-chave-aqui"')).toBe(true);
    // Mas a mesma linha sem marca nenhuma tem de passar pelos padrões.
    const real = `RESEND_API_KEY="re_${"Gk".repeat(5)}_${"z9".repeat(11)}"`;
    expect(MARCAS_DE_EXEMPLO.test(real)).toBe(false);
    expect(PADROES.some((p) => p.rx.test(real))).toBe(true);
  });

  it("nenhum arquivo rastreado carrega chave de provedor", () => {
    const fora = achados();
    expect(
      fora,
      `segredo versionado — REVOGUE a chave antes de remover o commit:\n${fora.join("\n")}`,
    ).toEqual([]);
  });
});
