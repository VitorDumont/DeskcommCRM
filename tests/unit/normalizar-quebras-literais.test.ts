/**
 * O `\n` literal que chegou ao cliente (2026-09-12) e comeu a divisão em bolhas.
 */
import { describe, expect, it } from "vitest";

import { normalizarQuebrasLiterais } from "@/lib/agent-engine/agent/normalizar-quebras";
import { splitIntoBubbles } from "@/lib/agent-engine/agent/split-message";

describe("normalizarQuebrasLiterais", () => {
  it("a mensagem real que saiu errada vira quebra de verdade", () => {
    const cru =
      "Oi Vitor! Desculpa mesmo a espera.\\n\\nA equipe que cuida do processo de comunidade tá ocupada agora.";
    const out = normalizarQuebrasLiterais(cru);
    expect(out).not.toContain("\\n");
    expect(out).toBe(
      "Oi Vitor! Desculpa mesmo a espera.\n\nA equipe que cuida do processo de comunidade tá ocupada agora.",
    );
  });

  it("texto sem escape passa intacto, e sem custo", () => {
    const ok = "Tudo certo!\n\nPosso ajudar em mais algo?";
    expect(normalizarQuebrasLiterais(ok)).toBe(ok);
  });

  it("`\\r\\n` não deixa `\\r` órfão para trás", () => {
    expect(normalizarQuebrasLiterais("a\\r\\nb")).toBe("a\nb");
  });

  it("vazio e não-string não explodem", () => {
    expect(normalizarQuebrasLiterais("")).toBe("");
    expect(normalizarQuebrasLiterais(undefined as unknown as string)).toBe(undefined);
  });

  /**
   * O ponto que faz isto ser mais que cosmética: sem normalizar, o separador de
   * parágrafo (`/\n{2,}/`) não casa e a resposta inteira sai numa bolha só.
   */
  it("destrava a divisão em bolhas que o escape tinha comido", () => {
    const cru = `${"a".repeat(60)}\\n\\n${"b".repeat(60)}`;
    expect(splitIntoBubbles(cru, 80)).toHaveLength(1);
    expect(splitIntoBubbles(normalizarQuebrasLiterais(cru), 80)).toHaveLength(2);
  });
});
