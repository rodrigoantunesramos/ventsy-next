# 01 — Relacionamento, Comunidade & Marketing

Páginas: **Clientes**, **Avaliações**, **Feedbacks**, **Campanhas**, **Marketing**, **Listas Oficiais**, **Portal do Cliente**, **Pesquisas & NPS**.

> Pré-requisito de todas: leia `00-contexto-base.md`. A entidade "cliente" já existe como `clientes_eventos` (CRM/Leads). Estas páginas orbitam essa tabela.

---

## Clientes (CRM 360º) · `/painel/clientes`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Clientes (CRM 360º)" em docs/prompts/01-relacionamento.md, depois implemente /painel/clientes à risca, no nível da página financeiro. Sem "R$" hardcoded (use lib/format).
```

- **NAV:** grupo Gestão. **Premium:** parcial (histórico/IA no Pro+).
- **Objetivo:** visão global e detalhada de cada cliente/contratante — quem é, quanto já gerou, todo o histórico de eventos, financeiro, conversas, documentos e avaliações num só lugar. É o "raio-x do cliente".
- **Dependências:** `clientes_eventos`, `lancamentos`/`parcelas`, `avaliacoes`, `documentos`, `conversas`/`mensagens`.

**Modelo de dados**
- Nova `clientes` (pessoa/empresa, distinta de um evento): `id, usuario_id, tipo ('pf'|'pj'), nome, doc (cpf/cnpj), email, telefone, whatsapp, endereco, cidade, estado, origem ('indicacao'|'site'|'instagram'|'google'|...), tags text[], segmento, aniversario date, obs, criado_em`.
- Ligar eventos: adicionar `cliente_id` em `clientes_eventos` (1 cliente → N eventos). Migração: derivar `clientes` a partir de `quem_contratou` distintos existentes.
- `clientes_interacoes`: `id, cliente_id, usuario_id, tipo ('ligacao'|'email'|'whatsapp'|'reuniao'|'nota'), conteudo, data, criado_em` (timeline manual + automática).

**Seções & funcionalidades**
1. **Lista** — busca, filtros (tag, segmento, cidade, origem, "VIP", "inativo 90d"), ordenação por LTV/recência. Cards no mobile, tabela no desktop. KPIs no topo: total de clientes, novos no mês, ticket médio, LTV médio, taxa de recompra, % inativos.
2. **Ficha do cliente** (`/painel/clientes/[id]`): cabeçalho com avatar/iniciais, contatos com ações (ligar, WhatsApp, e-mail), tags editáveis, score/segmento.
   - **Abas:** Visão geral · Eventos (todos os `clientes_eventos` dele, com status/valor) · Financeiro (recebido, em aberto, inadimplência) · Interações (timeline) · Documentos · Avaliações/Feedbacks dele · Campanhas recebidas.
   - **Métricas:** LTV, nº de eventos, ticket médio, último contato, próximo evento, dias desde a última compra.
3. **Segmentação inteligente:** RFM simples (Recência/Frequência/Valor) → rótulos automáticos (Campeão, Fiel, Em risco, Novo, Perdido). Usado por Campanhas.
4. **IA (Pro+):** resumo do cliente em 1 parágrafo, "próxima melhor ação", rascunho de mensagem de reativação.
5. **Ações:** novo cliente, importar CSV, exportar, mesclar duplicados, criar evento/proposta a partir do cliente.

**Critérios de aceite:** ficha abre <300ms com dados reais; segmentos RFM corretos; criar evento a partir do cliente pré-preenche `clientes_eventos`; importação CSV com de-dupe por doc/email.

---

## Avaliações (públicas — o dono responde) · `/painel/avaliacoes`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Avaliações" em docs/prompts/01-relacionamento.md, depois implemente /painel/avaliacoes. Reutilize a tabela `avaliacoes` existente e a rota app/api/avaliacoes. Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão. **Objetivo:** o dono vê todas as avaliações públicas que recebeu (por propriedade), responde publicamente, filtra por nota, e acompanha reputação ao longo do tempo.
- **Dependências:** `avaliacoes` (já existe, lado cliente em `app/api/avaliacoes` e `components/client/ReviewCard.tsx`).

**Modelo de dados** — estender `avaliacoes`: `resposta text, respondido_em timestamptz, oculta bool default false, destaque bool default false`. Garantir `propriedade_id`, `nota`, `texto`, `autor`, `evento_tipo`, `criado_em`, `verificada`.

**Seções & funcionalidades**
1. **KPIs:** nota média geral, distribuição 1–5 (barras), nº de avaliações, % respondidas, evolução mensal (sparkline), nota por propriedade e por tipo de evento.
2. **Feed de avaliações:** filtro por propriedade/nota/respondida/período; cada card mostra autor, nota, texto, evento, data. Ações: **responder** (caixa pública, com sugestão de IA), destacar (aparece no anúncio), ocultar (denúncia/abuso → fluxo de moderação), reportar.
3. **Resposta com IA (Pro+):** rascunho de resposta cordial baseado no teor (elogio → agradecer; crítica → empatia + solução). Tom configurável.
4. **Reputação:** comparativo com período anterior; alerta quando a média cai; "avaliações que pedem resposta há +48h".
5. **Pública:** a resposta aparece sob a avaliação no anúncio público (`(public)/propriedade`). Garanta que a API exponha `resposta`.

**Critérios de aceite:** responder persiste e aparece no público; distribuição e média batem com os dados; moderação esconde do público; sugestão de IA degrada se sem chave.

---

## Feedbacks (privados — cliente ↔ dono) · `/painel/feedbacks`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Feedbacks" em docs/prompts/01-relacionamento.md, depois implemente /painel/feedbacks (avaliação privada pós-evento, separada das avaliações públicas). Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão. **Objetivo:** canal privado de avaliação entre contratante e dono (NÃO aparece publicamente). Serve para ouvir críticas com franqueza, resolver internamente e medir satisfação real por evento.
- **Diferença vs. Avaliações:** feedback é privado, estruturado (notas por critério), ligado a um evento específico, e vira plano de ação interno.

**Modelo de dados**
- `feedbacks`: `id, usuario_id, cliente_id, evento_id (→clientes_eventos), canal ('formulario'|'whatsapp'|'presencial'), nota_geral int, criterios jsonb (ex.: {atendimento:5, estrutura:4, limpeza:5, custo_beneficio:3}), comentario, pontos_positivos, pontos_negativos, permite_publicar bool, status ('novo'|'em_tratativa'|'resolvido'), criado_em`.
- `feedbacks_acoes`: `id, feedback_id, descricao, responsavel, prazo date, status, criado_em` (plano de ação/CAPA).

**Seções & funcionalidades**
1. **Coleta:** link/QR de formulário privado por evento (rota pública leve `(public)/feedback/[token]`); ou registro manual; ou envio automático X dias após o evento (gancho com Automações).
2. **Painel:** CSAT médio, nota por critério (radar/barras em SVG), evolução, % que viraram ação, tempo médio de resolução, feedbacks por propriedade/tipo de evento.
3. **Tratativa:** cada feedback abre detalhe → criar ações (responsável/prazo), marcar resolvido, registrar resposta privada ao cliente (e-mail/WhatsApp). "Promover a avaliação pública" se `permite_publicar` e nota alta → cria registro em `avaliacoes`.
4. **IA (Pro+):** agrupa temas recorrentes ("3 menções a estacionamento"), sugere ação, sumariza o mês.

**Critérios de aceite:** formulário por token grava sem login; promover para público cria avaliação verificada; ações com prazo aparecem em atrasadas; CSAT por critério correto.

---

## Campanhas (envio em massa) · `/painel/campanhas`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Campanhas" em docs/prompts/01-relacionamento.md, depois implemente /painel/campanhas (disparo em massa para clientes por e-mail/WhatsApp). Use lib/email.ts. Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão (ou novo grupo "Marketing"). **Premium:** Pro+ (limite de envios por plano).
- **Objetivo:** criar e disparar mensagens em massa para segmentos de clientes (e-mail e/ou WhatsApp), com templates, agendamento e métricas.
- **Dependências:** `clientes`/`clientes_eventos` (segmentos), `lib/email.ts`.

**Modelo de dados**
- `campanhas`: `id, usuario_id, nome, canal ('email'|'whatsapp'|'sms'), assunto, corpo (html/text com variáveis {{nome}}, {{evento}}), segmento jsonb (filtros), agendada_para timestamptz, status ('rascunho'|'agendada'|'enviando'|'enviada'|'pausada'), criado_em`.
- `campanhas_envios`: `id, campanha_id, cliente_id, contato, status ('fila'|'enviado'|'entregue'|'aberto'|'clicado'|'falha'|'descadastrado'), enviado_em, erro`.
- `descadastros`: `id, usuario_id, cliente_id/contato, canal, criado_em` (opt-out — respeitar sempre).

**Seções & funcionalidades**
1. **Lista de campanhas** com status, alcance, aberturas, cliques.
2. **Construtor:** nome → canal → **público** (reusa segmentos de Clientes/RFM: "clientes de casamento 2024", "inativos 90d", "aniversariantes do mês") com contagem ao vivo → **mensagem** (editor com variáveis, preview, templates salvos) → **agendar/enviar**.
3. **Templates:** biblioteca (boas-vindas, pós-evento, reativação, promoção sazonal, aniversário, "indique"). **IA (Pro+):** gera assunto + corpo a partir de um objetivo.
4. **Envio:** e-mail via `lib/email.ts`; WhatsApp via provedor configurado em Integrações (degrade: gera links `wa.me` em lote se sem API). Processa em fila (rota `app/api/campanhas/enviar` + cron). Respeita opt-out e limite do plano.
5. **Métricas por campanha:** enviados/entregues/abertos/clicados/falhas/descadastros, funil, melhor horário. Pixel de abertura + redirect de clique (rota `app/api/track`, que já existe).
6. **Automações** (gancho): aniversário, X dias pós-evento, pós-feedback negativo (ver Automações).

**Critérios de aceite:** contagem de público ao vivo correta; envio respeita opt-out e limite do plano; tracking de abertura/clique grava; agendamento dispara por cron; nada bloqueia a UI durante o envio (fila assíncrona).

---

## Marketing (cockpit) · `/painel/marketing`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Marketing" em docs/prompts/01-relacionamento.md, depois implemente /painel/marketing (cockpit de aquisição: funil, canais, ROI, conteúdo, agenda). Sem "R$" hardcoded.
```

- **NAV:** novo grupo "Marketing". **Objetivo:** central de aquisição e presença — de onde vêm os leads, quanto custa cada canal, o que converte, e o calendário de conteúdo/ações.
- **Dependências:** `clientes_eventos` (origem/funil), `campanhas`, `avaliacoes`, `lancamentos` (gasto de marketing).

**Modelo de dados**
- `marketing_canais`: `id, usuario_id, nome ('Instagram'|'Google'|'Indicação'|...), tipo, custo_mensal_num, ativo`.
- `marketing_acoes`: `id, usuario_id, canal_id, titulo, tipo ('post'|'anuncio'|'parceria'|'evento'|'email'), data, status, investimento_num, resultado jsonb, criado_em`.
- `marketing_metas` (reusa `metas_financeiras` se possível).

**Seções & funcionalidades**
1. **Visão geral:** leads no mês por canal, CAC (gasto÷leads), taxa de conversão lead→contrato, ROI por canal (receita atribuída ÷ investimento), CPL. Atribuição via `clientes_eventos.origem`.
2. **Funil de aquisição:** visitante→lead→qualificado→proposta→fechado (puxa do CRM). Gargalos.
3. **Canais:** tabela editável de canais com custo, leads, conversão, ROI; ranking.
4. **Calendário de conteúdo/ações** (mês): posts, anúncios, parcerias, campanhas; arrastar para reagendar.
5. **Conteúdo & ativos:** biblioteca de fotos/vídeos do espaço (liga com `/painel/fotos`), gerador de legenda/post com IA, UTM builder, QR de divulgação.
6. **Reputação:** snapshot de avaliações (média, volume) e menções.

**Critérios de aceite:** ROI/CAC por canal corretos a partir de origem do CRM + gasto; calendário persiste; UTM/QR gerados; degrade sem IA.

---

## Listas Oficiais (comunidade) · `/painel/listas`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Listas Oficiais" em docs/prompts/01-relacionamento.md, depois implemente /painel/listas (curadoria de listas de lugares/fornecedores recomendados — comunidade). Inclua a rota pública de exibição. Sem "R$" hardcoded.
```

- **NAV:** grupo Marketing. **Objetivo:** clientes/donos criam listas curadas de lugares e fornecedores recomendados (ex.: "Melhores espaços para casamento em SP", "Fornecedores de som para shows"), gerando comunidade, SEO e descoberta. Equivale ao recurso da SpotEat.
- **Dois lados:** painel (criar/gerir minhas listas) + público (`(public)/listas` e `(public)/listas/[slug]`).

**Modelo de dados**
- `listas`: `id, autor_id (usuario/cliente), titulo, slug, descricao, capa_url, categoria, cidade, publica bool, curtidas int, salvos int, criado_em`.
- `listas_itens`: `id, lista_id, propriedade_id (→propriedades, opcional), nome_externo, tipo ('espaco'|'fornecedor'|'servico'), nota, comentario, ordem`.
- `listas_interacoes`: `id, lista_id, user_id, tipo ('curtir'|'salvar'|'seguir'), criado_em`.

**Seções & funcionalidades**
1. **Minhas listas** (painel): grid com status, alcance, curtidas; criar/editar (título, capa, categoria, itens — buscar propriedades da plataforma ou adicionar item externo; reordenar; nota/comentário por item).
2. **Pública:** página da lista com itens ricos (card de propriedade clicável → anúncio), botão curtir/salvar/compartilhar, autor, "listas relacionadas". Index `(public)/listas` com destaques, por cidade/categoria, ranking.
3. **Comunidade:** seguir autores, salvar listas, "minhas salvas". Donos podem aparecer em listas (gera tráfego ao anúncio).
4. **SEO:** slug, OpenGraph, sitemap.
5. **IA (opcional):** sugerir itens/descrição para uma lista.

**Critérios de aceite:** lista pública renderiza com itens reais; curtir/salvar exige login e persiste; propriedade na lista linka ao anúncio; SEO/OG corretos; moderação de conteúdo abusivo.

---

## Portal do Cliente (área do contratante) · `/painel/portal` + rota pública

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Portal do Cliente" em docs/prompts/01-relacionamento.md, depois implemente o Portal do Cliente: configuração no painel do dono + área logada do contratante para acompanhar o evento dele. Sem "R$" hardcoded.
```

- **Objetivo:** dar ao contratante uma área para acompanhar o próprio evento: contrato, pagamentos/parcelas, briefing, cronograma, lista de convidados, documentos e mensagens — reduzindo trabalho do dono. Reaproveita o route group `(client)`.
- **Dependências:** `clientes_eventos`, `parcelas`, `contratos`, `documentos`, `conversas`.

**Modelo de dados** — `portal_config` (por usuario_id: o que exibir, cores, boas-vindas); reuso de tabelas existentes. `convidados`: `id, evento_id, nome, email, status ('convidado'|'confirmado'|'recusado'|'checkin'), acompanhantes int, mesa, restricao_alimentar`.

**Seções & funcionalidades**
1. **No painel do dono** (`/painel/portal`): ativar/desativar, escolher módulos visíveis por evento, mensagem de boas-vindas, enviar convite de acesso ao cliente.
2. **Área do cliente** (`(client)/evento/[id]`): resumo do evento (data, espaço, status), **financeiro** (parcelas, pagar via MP), **contrato** (ver/assinar), **briefing** (formulário do evento), **cronograma/run-of-show** (somente leitura), **convidados** (cliente gerencia a própria lista, RSVP), **documentos**, **chat** com o dono, **avaliação/feedback** pós-evento.
3. **Notificações:** lembrete de parcela, "contrato pendente de assinatura", "evento em 7 dias".

**Critérios de aceite:** cliente só vê o próprio evento (RLS rígida); pagar parcela pelo portal cai no financeiro do dono; RSVP atualiza convidados; assinar contrato reflete no painel.

---

## Pesquisas & NPS pós-evento · `/painel/pesquisas`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Pesquisas & NPS" em docs/prompts/01-relacionamento.md, depois implemente /painel/pesquisas (construtor de pesquisas + NPS pós-evento). Sem "R$" hardcoded.
```

- **NAV:** grupo Marketing/Gestão. **Objetivo:** medir satisfação e NPS de forma estruturada, com pesquisas customizáveis disparadas após o evento, e acompanhar a evolução. Complementa Feedbacks (que é qualitativo/tratativa); aqui o foco é métrica e tendência.

**Modelo de dados**
- `pesquisas`: `id, usuario_id, titulo, tipo ('nps'|'csat'|'custom'), perguntas jsonb, gatilho ('manual'|'pos_evento'|'dias_apos'), ativo`.
- `pesquisas_respostas`: `id, pesquisa_id, evento_id, cliente_id, respostas jsonb, nps int, categoria ('promotor'|'neutro'|'detrator'), criado_em`.

**Seções & funcionalidades**
1. **Construtor:** perguntas (escala, múltipla, texto, NPS 0–10), lógica de disparo (X dias pós-evento via Automações), preview, link/QR público.
2. **Dashboard NPS:** score atual, evolução, % promotores/neutros/detratores, por propriedade/tipo de evento, comentários (nuvem de temas via IA), comparativo período.
3. **Ação:** detrator dispara alerta/feedback; promotor → CTA de avaliação pública e indicação.

**Critérios de aceite:** cálculo NPS correto (=%promotores−%detratores); respostas por token sem login; disparo automático funciona; segmentação por evento/propriedade.
