/**
 * O WhatsApp desconectado precisa APARECER no health — senão o alerta de
 * uptime, que exige `"status":"healthy"` no corpo, nunca dispara por isso.
 */
import { describe, expect, it } from "vitest";

import { avaliarSessoesWaha } from "@/lib/waha/saude-das-sessoes";

/** O corpo real desta instalação, com a sessão sadia. */
const sessaoWorking = [
  { name: "org_0b5c6021_56f0a2af", status: "WORKING", me: { id: "553484073462@c.us" } },
];

describe("saúde das sessões do WAHA", () => {
  it("sessão pareada e atendendo → ok", () => {
    expect(avaliarSessoesWaha(sessaoWorking)).toMatchObject({
      status: "ok",
      sessoes: 1,
      trabalhando: 1,
    });
  });

  it("sessão caída → degradado, que é o que faz o alerta tocar", () => {
    const r = avaliarSessoesWaha([{ name: "org_x", status: "FAILED" }]);
    expect(r.status).toBe("degraded");
    expect(r.estados).toBe("FAILED");
  });

  it("esperando QR também é degradado — ninguém está sendo atendido", () => {
    expect(avaliarSessoesWaha([{ name: "org_x", status: "SCAN_QR_CODE" }]).status).toBe("degraded");
  });

  it("instalação sem número conectado NÃO alerta", () => {
    // Toda instalação nova passaria por aqui. Alerta no primeiro dia é alerta
    // desligado no segundo.
    expect(avaliarSessoesWaha([])).toMatchObject({ status: "ok", sessoes: 0, trabalhando: 0 });
  });

  it("dois números, um caído: segue ok, e a contagem conta a história", () => {
    const r = avaliarSessoesWaha([
      { name: "a", status: "WORKING" },
      { name: "b", status: "FAILED" },
    ]);
    expect(r).toMatchObject({ status: "ok", sessoes: 2, trabalhando: 1 });
  });

  it("corpo inesperado não vira alarme de WhatsApp caído", () => {
    // Um upgrade do WAHA que mude o formato mandaria quem opera procurar no
    // lugar errado.
    for (const estranho of [null, undefined, {}, "texto", 42]) {
      expect(avaliarSessoesWaha(estranho).status).toBe("ok");
    }
  });

  it("status ausente ou esquisito conta como não-trabalhando", () => {
    const r = avaliarSessoesWaha([{ name: "a" }, { name: "b", status: 7 }]);
    expect(r.status).toBe("degraded");
    expect(r.estados).toBe("DESCONHECIDO");
  });

  it("aceita minúsculas — o vocabulário é do WAHA, não nosso", () => {
    expect(avaliarSessoesWaha([{ name: "a", status: "working" }]).status).toBe("ok");
  });

  /** Privacidade: o corpo do health é público. */
  it("não devolve nome de sessão, número nem push name", () => {
    const r = avaliarSessoesWaha([
      { name: "org_0b5c6021_56f0a2af", status: "FAILED", me: { id: "553484073462@c.us", pushName: "Clinic.AI" } },
    ]);
    const serializado = JSON.stringify(r);
    expect(serializado).not.toContain("org_0b5c6021");
    expect(serializado).not.toContain("553484073462");
    expect(serializado).not.toContain("Clinic.AI");
  });
});
