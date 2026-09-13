# Backup e restore — desta instalação

> Escrito depois de **restaurar de verdade**, não de ler o script. Os números
> abaixo saíram de um restore executado em 2026-09-13.

## O que roda sozinho

| O quê | Quando | Onde | Retenção |
|---|---|---|---|
| `backup.sh` (dump do banco + sessões do WhatsApp) | diário, 06:00 UTC (03:00 BRT) | `~/DeskcommCRM/backups` na VM | 14 de cada tipo |
| Snapshot do disco da VM | diário, 07:00 UTC | GCP, policy `crm-snapshot-diario` | 14 dias |

O cron está no crontab de **root** da VM, marcado `# deskcomm:backup`, e escreve
em `/var/log/deskcomm-backup.log`.

As duas camadas existem porque protegem de coisas diferentes: o dump protege de
perder o BANCO (o Supabase free não tem backup automático — está dito no
cabeçalho do próprio `backup.sh`), e o snapshot protege de perder a VM, que é
onde o dump mora. Só o dump não basta: ele está no disco que se quer proteger.

## O restore — e a armadilha que ele tem

Restaurar num Postgres **puro** produz centenas de erros que NÃO são corrupção
do backup. Medido: 344 erros num restore cujos dados vieram todos.

    321  role "authenticated" does not exist     ← GRANTs do Supabase
     13  relation "public.ai_chunks" does not exist
      5  type "public.vector" does not exist     ← extensão pgvector
      3  função já existe / 2 schema_migrations já existe

Os 321 são concessão de privilégio às roles que o Supabase cria (`authenticated`,
`anon`, `service_role`) e que não existem fora dele. Os de `vector` são a
extensão `pgvector` ausente. **Nenhum deles perde linha.** Conferido contra a
produção no mesmo instante:

| tabela | produção | restaurado |
|---|---|---|
| `messages` | 19 | 19 |
| `conversations` | 1 | 1 |
| `contacts` | 1 | 1 |
| `ai_agents` | 2 | 2 |
| `ai_models` | 45 | 45 |
| `organizations` | 1 | 1 |

O alvo de um restore REAL é outro projeto Supabase, que já tem as roles e a
extensão — e lá esses erros não aparecem. Contar erro como falha leva a
descartar um backup bom; é o modo de falha que este documento existe para
evitar.

## Conferir que o backup de hoje presta (2 min, sem tocar em produção)

```bash
cd ~/DeskcommCRM/backups
DUMP=$(ls -1t db-*.sql.gz | head -1)

# 1. o dump tem estrutura E dados?
zcat "$DUMP" | grep -cE "^CREATE TABLE"   # esperado: ~168
zcat "$DUMP" | grep -cE "^COPY public\."  # esperado: ~127

# 2. restaura num descartável e compara
sudo docker run -d --name pg-teste -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=r postgres:17-alpine
sleep 8
zcat "$DUMP" | sudo docker exec -i pg-teste psql -U postgres -d r -q
sudo docker exec pg-teste psql -U postgres -d r -c "select count(*) from messages;"
sudo docker rm -f pg-teste
```

Um dump com `CREATE TABLE` e **zero** `COPY` é o caso perigoso: estrutura sem
dados, e ele sai verde no script. É o que a sonda 1 pega.

## Restaurar para valer

1. Crie um projeto Supabase novo (mesma região, `us-west-2`).
2. `zcat db-<ts>.sql.gz | psql "<SUPABASE_DB_URL do projeto novo>"`
3. Troque `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL` e as duas chaves no
   `.env` da VM.
4. Sessões do WhatsApp: `tar xzf waha-<ts>.tgz -C /var/lib/docker/volumes` com o
   stack parado — sem isso, o número precisa parear por QR de novo.
5. `docker compose -f docker-compose.prod.yml up -d`
