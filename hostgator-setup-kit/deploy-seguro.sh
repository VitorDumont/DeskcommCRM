#!/usr/bin/env bash
# Deploy com rede: confere o CI, guarda a imagem atual, sobe a nova e VOLTA
# sozinho se o contêiner não ficar saudável.
#
# ── Por que existe ───────────────────────────────────────────────────────────
#
# O caminho manual desta instalação é `docker compose pull && up -d`, e ele tem
# dois buracos medidos:
#
#   1. `publish-image.yml` publica `latest` em TODO push na `main`, sem esperar
#      o `ci`. Medido em 2026-09-12 no commit 25a86896: `ci` reprovou (typecheck)
#      e a imagem foi publicada assim mesmo. No upstream isso não morde porque
#      lá `imagens-ok` é required check e nada entra na `main` sem passar; aqui,
#      com push direto, `latest` pode carregar código que o CI reprovou.
#   2. Se a imagem nova não sobe, o CRM fica fora do ar até alguém reparar. O
#      `agent.sh` tem rollback para o update do upstream; o deploy manual não
#      tinha nenhum.
#
# Uso, dentro de ~/DeskcommCRM na VM:
#   bash hostgator-setup-kit/deploy-seguro.sh            # confere o CI antes
#   bash hostgator-setup-kit/deploy-seguro.sh --sem-ci   # pula a conferência
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker-compose.prod.yml"
SERVICOS="app worker scheduler"
ESPERA_SEGUNDOS=150
CONFERIR_CI=1
[ "${1:-}" = "--sem-ci" ] && CONFERIR_CI=0

vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
verde()    { printf '\033[32m%s\033[0m\n' "$*"; }

# ── 1. O commit que vamos subir passou no CI? ────────────────────────────────
#
# Sem `gh` ou sem rede, AVISA e segue: recusar deploy porque não deu para
# perguntar ao GitHub seria trocar um risco por outro maior — a instalação
# ficaria sem caminho de atualização quando mais precisa dele.
if [ "$CONFERIR_CI" = "1" ]; then
  sha="$(git rev-parse HEAD 2>/dev/null || true)"
  # `curl` na API pública, e não `gh`: a VM não tem o gh instalado (conferido), e
  # o repositório é público — ler runs não pede autenticação. Instalar o gh na
  # VPS do cliente para conferir um status seria pedir dependência nova ao
  # operador, que é justamente o que a doutrina de packaging não quer.
  estado=""
  if [ -n "$sha" ]; then
    estado="$(curl -fsS --max-time 15 \
      "https://api.github.com/repos/VitorDumont/DeskcommCRM/actions/runs?head_sha=${sha}&per_page=20" 2>/dev/null \
      | python3 -c 'import json,sys
try:
    runs = json.load(sys.stdin).get("workflow_runs", [])
except Exception:
    print(""); raise SystemExit
ci = [r for r in runs if r.get("name") == "ci"]
print(ci[0].get("conclusion") or "em_andamento" if ci else "")' 2>/dev/null || echo "")"
  fi
  case "$estado" in
    success) verde "✓ ci verde em ${sha:0:8}" ;;
    failure) vermelho "✗ o ci REPROVOU em ${sha:0:8} — abortando"
             vermelho "  use --sem-ci se souber o que está fazendo"; exit 1 ;;
    "")      vermelho "⚠ não consegui falar com o GitHub — seguindo sem conferir o ci" ;;
    *)       vermelho "⚠ ci em '${estado}' — seguindo mesmo assim" ;;
  esac
fi

# ── 2. A rede: de onde voltar ────────────────────────────────────────────────
declare -A ANTES
for s in $SERVICOS; do
  ANTES[$s]="$(docker compose -f "$COMPOSE" images -q "$s" 2>/dev/null | head -1 || true)"
done

docker compose -f "$COMPOSE" pull $SERVICOS
docker compose -f "$COMPOSE" up -d $SERVICOS

# ── 3. Ficou de pé? ──────────────────────────────────────────────────────────
#
# Mede o HEALTHCHECK do contêiner, não "subiu": um app que entra em crashloop
# aparece como `Up` entre uma morte e outra.
saudavel=0
for _ in $(seq 1 $((ESPERA_SEGUNDOS / 5))); do
  estado="$(docker inspect --format '{{.State.Health.Status}}' \
    "$(docker compose -f "$COMPOSE" ps -q app)" 2>/dev/null || echo "")"
  [ "$estado" = "healthy" ] && { saudavel=1; break; }
  sleep 5
done

if [ "$saudavel" = "1" ]; then
  verde "✓ app saudável — deploy concluído"
  docker compose -f "$COMPOSE" ps --format "  {{.Name}}\t{{.Status}}"
  exit 0
fi

# ── 4. Não ficou: volta ──────────────────────────────────────────────────────
vermelho "✗ o app não ficou saudável em ${ESPERA_SEGUNDOS}s — VOLTANDO"
docker compose -f "$COMPOSE" logs --tail 30 app || true
for s in $SERVICOS; do
  [ -n "${ANTES[$s]:-}" ] || continue
  # Pina pelo ID da imagem anterior: é o que o `agent.sh` faz, e não depende de
  # a tag `latest` ainda apontar para onde apontava quando este deploy começou.
  chave="$(echo "$s" | tr '[:lower:]' '[:upper:]')_IMAGE"
  sed -i "s|^${chave}=.*|${chave}=\"${ANTES[$s]}\"|" .env
done
docker compose -f "$COMPOSE" up -d $SERVICOS
vermelho "  imagens anteriores restauradas no .env — confira antes do próximo deploy"
exit 1
