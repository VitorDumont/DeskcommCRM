-- ============================================================================
-- 0239 — CATÁLOGO DA OPENROUTER (10 pagos + 10 gratuitos)
--
-- A 0127 removeu os CHECKs de `provider` para destravar a OpenRouter, e parou
-- aí: dava para CADASTRAR a credencial e não dava para ESCOLHER modelo. A tela
-- do agente lê `GET /api/v1/ai/providers/:provider/models`, que serve de
-- `ai_models` — e `ai_models` nunca teve uma linha de openrouter. O sintoma é
-- mudo e engana: a credencial valida, grava 445 ids em
-- `ai_provider_credentials.models_available`, a tela diz "Nenhum modelo
-- disponível", e quem opera conclui que a chave está errada.
--
-- `models_available` NÃO serve para alimentar o seletor, e é de propósito:
-- `tests/invariants/catalogo-de-modelos.test.ts` exige que todo modelo ofertado
-- tenha preço nos DOIS lados (`ai_models` e `ai_pricing`). Servir os 445 ids
-- crus ofereceria modelo sem preço — o gasto não entraria na conta e o teto de
-- orçamento nunca dispararia. Catálogo curado é a resposta certa; o que faltava
-- era curá-lo.
--
-- IDS E PREÇOS VERIFICADOS NO PROVEDOR, não digitados à mão:
--   GET https://openrouter.ai/api/v1/models   (445 modelos, em 2026-09-12)
-- Os 20 desta lista têm `tools` em `supported_parameters` — sem tool calling o
-- agente não chama ferramenta nenhuma, e ofertar isso seria oferecer defeito.
-- `context_window` vem do campo `context_length` do provedor.
--
-- Preços em CENTAVOS por milhão de tokens: `pricing.prompt` (USD por token)
-- x 1e8. Os gratuitos entram com 0/0, que é o preço real deles — e mantém o
-- invariante de preço satisfeito em vez de furado.
--
-- O padrão do provedor é `anthropic/claude-sonnet-5`: mesma família que esta
-- instalação já roda direto na Anthropic. Um índice parcial UNIQUE garante um
-- único padrão por provedor.
--
-- Idempotente: `on conflict do update` nas duas tabelas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. catálogo curado (o que a tela oferece)
-- ---------------------------------------------------------------------------
insert into public.ai_models
  (provider, model_id, display_name, description,
   context_window, input_price_per_million_cents, output_price_per_million_cents,
   supports_tools, is_default_for_provider)
values

  ('openrouter', 'anthropic/claude-opus-5', 'Claude Opus 5',
   'O mais capaz da Anthropic para trabalho agêntico complexo.',
   1000000, 500, 2500, true, false),
  ('openrouter', 'anthropic/claude-sonnet-5', 'Claude Sonnet 5',
   'Equilíbrio de capacidade e custo para atendimento e agentes. É o padrão deste provedor.',
   1000000, 200, 1000, true, true),
  ('openrouter', 'openai/gpt-5.5', 'GPT-5.5',
   'Topo da linha GPT-5.5 da OpenAI.',
   1050000, 500, 3000, true, false),
  ('openrouter', 'openai/gpt-5.6-terra', 'GPT-5.6 Terra',
   'Equilíbrio de custo e capacidade da linha 5.6 da OpenAI.',
   1050000, 200, 1200, true, false),
  ('openrouter', 'openai/gpt-5.6-luna', 'GPT-5.6 Luna',
   'O mais barato da linha 5.6 — classificação e tarefas simples.',
   1050000, 20, 120, true, false),
  ('openrouter', 'google/gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview',
   'Topo da linha Gemini 3.1 do Google.',
   1048576, 200, 1200, true, false),
  ('openrouter', 'google/gemini-3.5-flash', 'Gemini 3.5 Flash',
   'Gemini rápido e barato, janela de 1M de tokens.',
   1048576, 150, 900, true, false),
  ('openrouter', 'x-ai/grok-4.6', 'Grok 4.6',
   'Grok 4.6 da xAI, janela de 500k.',
   500000, 200, 600, true, false),
  ('openrouter', 'deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro 0423',
   'Custo-benefício agressivo com janela de 1M.',
   1048576, 160, 320, true, false),
  ('openrouter', 'meta-llama/llama-4-scout', 'Llama 4 Scout',
   'O mais barato desta seleção; janela de 1,3M.',
   1310720, 10, 30, true, false),
  ('openrouter', 'thinkingmachines/inkling:free', 'Inkling (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   1048576, 0, 0, true, false),
  ('openrouter', 'thinkingmachines/inkling-small:free', 'Inkling Small (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   1048576, 0, 0, true, false),
  ('openrouter', 'nvidia/nemotron-3.5-lightning:free', 'Nemotron 3.5 Lightning (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   1000000, 0, 0, true, false),
  ('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   1000000, 0, 0, true, false),
  ('openrouter', 'nvidia/nemotron-3-super-120b-a12b:free', 'Nemotron 3 Super (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   262144, 0, 0, true, false),
  ('openrouter', 'google/gemma-4-31b-it:free', 'Gemma 4 31B (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   262144, 0, 0, true, false),
  ('openrouter', 'google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B A4B  (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   262144, 0, 0, true, false),
  ('openrouter', 'cohere/north-mini-code:free', 'North Mini Code (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   256000, 0, 0, true, false),
  ('openrouter', 'inclusionai/ling-3.0-flash-vl:free', 'Ling 3.0 Flash VL (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   262144, 0, 0, true, false),
  ('openrouter', 'nex-agi/nex-n2.5-pro:free', 'Nex-N2.5-Pro (free)',
   'Gratuito no OpenRouter — sujeito a limite de requisições por minuto e por dia.',
   262144, 0, 0, true, false)
on conflict (provider, model_id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  context_window = excluded.context_window,
  input_price_per_million_cents = excluded.input_price_per_million_cents,
  output_price_per_million_cents = excluded.output_price_per_million_cents,
  supports_tools = excluded.supports_tools,
  is_default_for_provider = excluded.is_default_for_provider;

-- ---------------------------------------------------------------------------
-- 2. preço (o que a conta usa) — os MESMOS números, senão a tela mente
-- ---------------------------------------------------------------------------
insert into public.ai_pricing
  (model, prompt_cents_per_million_tokens, completion_cents_per_million_tokens, notes)
values
  ('anthropic/claude-opus-5', 500, 2500, 'catálogo openrouter (0239)'),
  ('anthropic/claude-sonnet-5', 200, 1000, 'catálogo openrouter (0239)'),
  ('openai/gpt-5.5', 500, 3000, 'catálogo openrouter (0239)'),
  ('openai/gpt-5.6-terra', 200, 1200, 'catálogo openrouter (0239)'),
  ('openai/gpt-5.6-luna', 20, 120, 'catálogo openrouter (0239)'),
  ('google/gemini-3.1-pro-preview', 200, 1200, 'catálogo openrouter (0239)'),
  ('google/gemini-3.5-flash', 150, 900, 'catálogo openrouter (0239)'),
  ('x-ai/grok-4.6', 200, 600, 'catálogo openrouter (0239)'),
  ('deepseek/deepseek-v4-pro', 160, 320, 'catálogo openrouter (0239)'),
  ('meta-llama/llama-4-scout', 10, 30, 'catálogo openrouter (0239)'),
  ('thinkingmachines/inkling:free', 0, 0, 'catálogo openrouter (0239)'),
  ('thinkingmachines/inkling-small:free', 0, 0, 'catálogo openrouter (0239)'),
  ('nvidia/nemotron-3.5-lightning:free', 0, 0, 'catálogo openrouter (0239)'),
  ('nvidia/nemotron-3-ultra-550b-a55b:free', 0, 0, 'catálogo openrouter (0239)'),
  ('nvidia/nemotron-3-super-120b-a12b:free', 0, 0, 'catálogo openrouter (0239)'),
  ('google/gemma-4-31b-it:free', 0, 0, 'catálogo openrouter (0239)'),
  ('google/gemma-4-26b-a4b-it:free', 0, 0, 'catálogo openrouter (0239)'),
  ('cohere/north-mini-code:free', 0, 0, 'catálogo openrouter (0239)'),
  ('inclusionai/ling-3.0-flash-vl:free', 0, 0, 'catálogo openrouter (0239)'),
  ('nex-agi/nex-n2.5-pro:free', 0, 0, 'catálogo openrouter (0239)')
on conflict (model) do update set
  prompt_cents_per_million_tokens = excluded.prompt_cents_per_million_tokens,
  completion_cents_per_million_tokens = excluded.completion_cents_per_million_tokens,
  notes = excluded.notes,
  superseded_at = null;
