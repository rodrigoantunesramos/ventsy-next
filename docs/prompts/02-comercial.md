# 02 — Comercial (Reservas, Precificação, Propostas, Contratos)

Páginas: **Reservas & Calendário multi-espaço**, **Precificação & Tabela de preços**, **Orçamentos & Propostas**, **Contratos & Assinatura digital**.

> Pré-requisito: leia `00-contexto-base.md`. Este é o motor de receita: precificação → proposta → contrato → reserva confirmada → financeiro. Tudo gira em `clientes_eventos`.

---

## Reservas & Calendário multi-espaço · `/painel/reservas` + `/painel/calendario`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Reservas & Calendário multi-espaço" em docs/prompts/02-comercial.md. As rotas /painel/reservas e /painel/calendario já existem — estenda-as para multi-espaço, bloqueios, hold e detecção de conflito. Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão (já existe). **Objetivo:** agenda central de TODOS os espaços do dono, com confirmação, bloqueios, reservas provisórias (hold), detecção de conflito e ocupação. Pensar grande: um parque de exposições tem arena + galpão + camarote + estacionamento + área externa, cada um reservável separadamente e às vezes simultaneamente.

**Modelo de dados**
- `reservas` (estender): `id, usuario_id, propriedade_id, espaco_id (sub-espaço), evento_id (→clientes_eventos), titulo, inicio timestamptz, fim timestamptz, status ('hold'|'confirmada'|'bloqueio'|'manutencao'|'cancelada'), origem ('manual'|'site'|'proposta'), hold_expira_em, cor, obs, criado_em`.
- `espacos`: sub-espaços de uma propriedade — `id, propriedade_id, nome, capacidade, area_m2, tipo ('salao'|'arena'|'galpao'|'externa'|'camarote'|'estacionamento'|...), reservavel_isolado bool`.
- `bloqueios_recorrentes`: manutenção semanal, indisponibilidade.

**Seções & funcionalidades**
1. **Calendário** com visões mês/semana/dia e **timeline por espaço** (eixo Y = espaços, eixo X = tempo — estilo Gantt) para enxergar simultaneidade e conflitos. Cores por status. Arrastar para mover/redimensionar.
2. **Detecção de conflito:** ao criar/mover, bloqueia sobreposição no mesmo espaço (considera buffer de montagem/desmontagem configurável). Permite eventos simultâneos em espaços distintos.
3. **Hold/reserva provisória:** segura a data por N horas/dias com expiração automática (libera se não confirmar). Útil enquanto a proposta está em aberto.
4. **Ocupação:** % de ocupação por espaço/mês, dias livres, mapa de calor anual, datas mais procuradas, receita por slot.
5. **Ações rápidas:** nova reserva → vincula/cria cliente+evento; bloquear data; converter hold em confirmada; gerar proposta a partir de uma data.
6. **Sincronização:** export iCal/Google Calendar (feed `.ics` por propriedade) para evitar overbooking com canais externos.

**Critérios de aceite:** conflito no mesmo espaço é impedido; simultâneo em espaços diferentes é permitido; hold expira via cron; timeline por espaço renderiza; .ics válido.

---

## Precificação & Tabela de preços · `/painel/precificacao`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Precificação" em docs/prompts/02-comercial.md, depois implemente /painel/precificacao (tabela de preços por espaço, sazonalidade, dia da semana, tipo de evento, pacotes e regras). Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão. **Objetivo:** definir como o espaço é cobrado, de forma flexível, para alimentar Propostas e Reservas automaticamente. Locação de eventos tem precificação complexa: diária vs. período, baixa/alta temporada, fim de semana, feriado, por pessoa, por hora, taxas (limpeza, segurança, energia), pacotes.

**Modelo de dados**
- `precos_tabela`: `id, usuario_id, propriedade_id, espaco_id, nome, base ('diaria'|'periodo'|'hora'|'pessoa'|'pacote'), valor_base_num, moeda, ativo`.
- `precos_regras`: `id, tabela_id, tipo ('temporada'|'dia_semana'|'feriado'|'tipo_evento'|'antecedencia'|'duracao'|'qtd_convidados'), condicao jsonb, ajuste_tipo ('percentual'|'fixo'|'substitui'), ajuste_valor, prioridade`.
- `taxas`: `id, usuario_id, propriedade_id, nome ('Limpeza'|'Segurança'|'Energia'|'Caução'|'Taxa de som'...), tipo ('fixo'|'percentual'|'por_pessoa'|'por_hora'), valor, obrigatoria bool, reembolsavel bool`.
- `pacotes`: `id, usuario_id, nome, itens jsonb (espaço + serviços inclusos), valor_num, descricao`.

**Seções & funcionalidades**
1. **Tabelas por espaço:** valor base + unidade. Visual de calendário de tarifas (alta/baixa por cor) editável.
2. **Regras dinâmicas:** sazonalidade (datas), multiplicador fim de semana/feriado, desconto por antecedência ou baixa procura, acréscimo por tipo de evento (corporativo paga mais), faixas por nº de convidados/horas.
3. **Taxas e adicionais:** catálogo (limpeza, segurança, energia, caução, hora extra) marcáveis como obrigatórias.
4. **Pacotes:** montar combos (espaço + buffet + som) com preço fechado.
5. **Simulador:** escolher espaço + data + convidados + duração → mostra o preço calculado (mesma engine que a Proposta usará). Comparar com concorrência (campo manual) e com custo (margem).
6. **Engine reutilizável:** extraia um `lib/pricing.ts` puro (`calcularPreco(input): Breakdown`) consumido por Precificação, Propostas, Reservas e o anúncio público.

**Critérios de aceite:** simulador e proposta usam a MESMA `lib/pricing.ts`; regras aplicam por prioridade; taxas obrigatórias entram no total; breakdown transparente (base + ajustes + taxas).

---

## Orçamentos & Propostas · `/painel/propostas`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Orçamentos & Propostas" em docs/prompts/02-comercial.md, depois implemente /painel/propostas (construtor de proposta comercial → PDF/link → aprovação → vira contrato). Use lib/pricing.ts e jspdf. Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão. **Objetivo:** transformar um lead em proposta comercial profissional (orçamento), enviá-la por link/PDF, acompanhar status (vista/aceita/recusada) e converter em contrato + reserva. Substitui o orçamento feito no WhatsApp/Word.

**Modelo de dados**
- `propostas`: `id, usuario_id, cliente_id, evento_id, propriedade_id, numero, titulo, itens jsonb (descrição, qtd, valor unit, total — espaço + taxas + pacotes), subtotal_num, desconto_num, total_num, validade date, condicoes_pagamento jsonb, status ('rascunho'|'enviada'|'vista'|'aceita'|'recusada'|'expirada'), link_token, aceita_em, criado_em`.
- Templates: `propostas_templates` (modelos reutilizáveis por tipo de evento).

**Seções & funcionalidades**
1. **Lista** com funil (rascunho→enviada→vista→aceita), valor em negociação, taxa de conversão, ticket médio, tempo médio até aceite.
2. **Construtor:** cliente/evento (cria se novo) → espaço + data (checa disponibilidade em Reservas, cria hold) → itens (puxa preço de `lib/pricing.ts`, adiciona taxas/pacotes/serviços) → desconto → condições de pagamento (entrada + parcelas) → validade → observações/cláusulas. Preview ao vivo.
3. **Envio:** gera PDF (jspdf, com marca/logo) e **link público** (`(public)/proposta/[token]`) que o cliente abre, vê bonito, e clica **Aceitar/Recusar**. Tracking de "visualizada".
4. **Conversão:** ao aceitar → cria/atualiza `contratos`, confirma reserva (hold→confirmada), gera parcelas em `parcelas`, move o lead no funil. Notifica o dono.
5. **IA (Pro+):** redige texto da proposta, sugere upsell (pacotes), e melhor condição de pagamento.

**Critérios de aceite:** proposta usa preços da engine; link público aceita/recusa sem login; aceite cria contrato+reserva+parcelas atomicamente; PDF com marca; numeração sequencial por usuário.

---

## Contratos & Assinatura digital · `/painel/contratos`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Contratos & Assinatura digital" em docs/prompts/02-comercial.md, depois implemente /painel/contratos (geração a partir de template, variáveis, assinatura eletrônica com trilha de auditoria). Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão. **Objetivo:** gerar contratos de locação a partir de modelos com variáveis, enviar para assinatura eletrônica do contratante (e testemunhas), e manter trilha de auditoria juridicamente útil. Sem depender de DocuSign (mas permitir integração).

**Modelo de dados**
- `contratos_templates`: `id, usuario_id, nome, tipo_evento, corpo (markdown/html com {{variaveis}}), clausulas jsonb`.
- `contratos`: `id, usuario_id, cliente_id, evento_id, proposta_id, numero, template_id, conteudo_final (snapshot), valor_num, status ('rascunho'|'enviado'|'assinado'|'cancelado'|'rescindido'), enviado_em, assinado_em, link_token, pdf_url, criado_em`.
- `contratos_assinaturas`: `id, contrato_id, signatario_nome, signatario_doc, papel ('contratante'|'contratada'|'testemunha'), email, assinou_em, ip, user_agent, hash, metodo ('clique'|'desenho'|'token_email')`.

**Seções & funcionalidades**
1. **Modelos:** editor de template com variáveis ({{cliente.nome}}, {{evento.data}}, {{valor}}, {{espaco}}, cláusulas opcionais — multa, caução, cancelamento, força maior, uso de imagem/LGPD, regras da casa). Biblioteca por tipo de evento.
2. **Geração:** a partir de proposta aceita ou avulso → preenche variáveis → preview → snapshot imutável do conteúdo.
3. **Assinatura eletrônica:** link público (`(public)/contrato/[token]`); signatário confere, dá aceite (checkbox + nome/doc + opcional desenho da assinatura), registra IP/UA/timestamp/hash. Multi-signatário (contratante + contratada + testemunhas). E-mail com cópia do PDF assinado e do "certificado de assinatura" (trilha).
4. **Gestão:** status, vencimentos, renovações, aditivos, rescisão (com cálculo de multa puxando de `taxas`). Alertas de contrato não assinado.
5. **Integração opcional:** conector para assinatura qualificada (gov.br/ICP, DocuSign, ZapSign) via Integrações; degrade para a assinatura própria.

**Critérios de aceite:** conteúdo vira snapshot imutável após envio; assinatura grava trilha (IP/UA/hash/timestamp); multi-signatário; PDF final + certificado; criar a partir de proposta aceita preenche tudo.
