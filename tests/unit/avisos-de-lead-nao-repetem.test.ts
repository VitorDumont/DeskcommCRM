/**
 * O aviso de lead marca TRANSIÇÃO, não toque.
 *
 * `crm_leads` está com REPLICA IDENTITY default, então o `old` do Realtime traz
 * só a PK. Quem comparasse com ele reanunciaria a cada edição.
 */
import { describe, expect, it } from "vitest";

import { decidirAvisosDeLead, type MemoriaDoLead } from "@/lib/notifications/avisos-de-lead";

const EU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

/** O payload REAL desta instalação: `old` só com a chave primária. */
const oldSoComPk = { id: "lead-1" };

describe("o aviso de lead não se repete a cada edição", () => {
  it("primeira vez que a tela vê o lead: cala", () => {
    // Sem `old` útil e sem memória, não há como saber se houve transição.
    // Avisar aqui seria o defeito original com outra roupa.
    const r = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "won", title: "Acme" },
      antigo: oldSoComPk,
      userId: EU,
      memoria: undefined,
    });
    expect(r.avisos).toEqual([]);
    expect(r.memoria).toEqual({ owner: EU, status: "won" });
  });

  it("editar um lead JÁ ganho não reanuncia a venda", () => {
    const memoria: MemoriaDoLead = { owner: EU, status: "won" };
    const r = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "won", title: "Acme (nova tag)" },
      antigo: oldSoComPk,
      userId: EU,
      memoria,
    });
    expect(r.avisos).toEqual([]);
  });

  it("a venda de verdade anuncia uma vez", () => {
    const r = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "won" },
      antigo: oldSoComPk,
      userId: EU,
      memoria: { owner: EU, status: "open" },
    });
    expect(r.avisos).toEqual(["lead_won"]);
  });

  it("a atribuição de verdade anuncia uma vez", () => {
    const r = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "open" },
      antigo: oldSoComPk,
      userId: EU,
      memoria: { owner: OUTRO, status: "open" },
    });
    expect(r.avisos).toEqual(["lead_assigned"]);
  });

  it("lead de outra pessoa não avisa nada", () => {
    const r = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: OUTRO, status: "won" },
      antigo: oldSoComPk,
      userId: EU,
      memoria: { owner: OUTRO, status: "open" },
    });
    expect(r.avisos).toEqual([]);
  });

  it("perder anuncia uma vez, e reeditar depois não repete", () => {
    const primeira = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "lost" },
      antigo: oldSoComPk,
      userId: EU,
      memoria: { owner: EU, status: "open" },
    });
    expect(primeira.avisos).toEqual(["lead_lost"]);

    const segunda = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "lost", title: "outro nome" },
      antigo: oldSoComPk,
      userId: EU,
      memoria: primeira.memoria,
    });
    expect(segunda.avisos).toEqual([]);
  });

  /**
   * A defesa contra a correção envelhecer: se alguém ligar REPLICA IDENTITY
   * FULL em `crm_leads`, o `old` passa a trazer os campos e ele deve MANDAR,
   * por ser a verdade do banco e não uma lembrança da aba aberta.
   */
  it("quando o `old` traz os campos, é ele que manda — nem a memória o contradiz", () => {
    const r = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "won" },
      antigo: { id: "lead-1", owner_user_id: EU, status: "won" },
      userId: EU,
      memoria: { owner: OUTRO, status: "open" },
    });
    expect(r.avisos).toEqual([]);
  });

  it("atribuição vinda de um `old` completo é reconhecida", () => {
    const r = decidirAvisosDeLead({
      novo: { id: "lead-1", owner_user_id: EU, status: "open" },
      antigo: { id: "lead-1", owner_user_id: OUTRO, status: "open" },
      userId: EU,
      memoria: undefined,
    });
    expect(r.avisos).toEqual(["lead_assigned"]);
  });
});
