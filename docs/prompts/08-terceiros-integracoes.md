# 08 — Terceiros & Integrações

Páginas: **Terceiros (custo × retorno)**, **Integrações (apps, APIs, webhooks)**.

> Pré-requisito: leia `00-contexto-base.md`. "Terceiros" aqui é a visão **gerencial** de prestadores terceirizados (quanto custam × quanto devolvem para a empresa) — complementa o cadastro operacional de `/painel/fornecedores`. "Integrações" é a camada técnica de conexão com serviços externos. Já existe `app/api/integracoes`.

---

## Terceiros (custo × retorno) · `/painel/terceiros`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Terceiros (custo × retorno)" em docs/prompts/08-terceiros-integracoes.md, depois implemente /painel/terceiros (gestão de serviços terceirizados com custo, contrato, SLA e ROI: o quanto cada terceirizado custa e o que devolve). Reutilize fornecedores quando fizer sentido. Sem "R$" hardcoded.
```

- **NAV:** novo grupo "Inteligência" (ou Suprimentos). **Objetivo:** enxergar cada serviço terceirizado como um investimento: **quanto custa** (mensal/por evento) e **o que devolve** (receita gerada, eventos atendidos, economia, SLA cumprido). Ex.: segurança terceirizada, limpeza, contabilidade, agência de marketing, TI/software, manutenção, valet, buffet terceirizado, jurídico. Decisão: manter, trocar, renegociar ou internalizar.

**Modelo de dados**
- `terceiros`: `id, usuario_id, fornecedor_id (→fornecedores, opcional), servico, categoria ('seguranca'|'limpeza'|'contabilidade'|'marketing'|'ti'|'manutencao'|'juridico'|'buffet'|'valet'|...), modelo_custo ('mensal'|'por_evento'|'percentual'|'hora'), custo_num, contrato_id, vigencia_inicio, vigencia_fim, sla jsonb, status, criado_em`.
- `terceiros_resultados`: `id, terceiro_id, competencia, custo_num, receita_atribuida_num, eventos_atendidos int, economia_num, sla_cumprido_pct, satisfacao, obs` (medição periódica).

**Seções & funcionalidades**
1. **Carteira de terceiros:** lista por categoria com custo mensal/anual, vigência, SLA, status; custo total terceirizado e % sobre a receita.
2. **Ficha custo×retorno:** por terceiro — custo no período × retorno (receita atribuída, eventos atendidos, economia gerada, SLA cumprido, satisfação interna) → **ROI/índice de valor**; evolução; comparação com alternativa (internalizar).
3. **Contratos & SLA:** vínculo ao contrato (renovação/rescisão), metas de SLA e cumprimento, multas/glosas.
4. **Análise de decisão:** ranking "mantém/renegocia/troca/internaliza", alertas (custo subindo, SLA caindo, contrato vencendo).
5. **Integra:** custo puxa de Contas a Pagar/Compras; receita atribuída do Financeiro/eventos.

**Critérios de aceite:** ROI por terceiro a partir de custo (AP) e retorno medido; SLA cumprido vs. meta; alerta de contrato vencendo e custo crescente; ranking de decisão; % terceirizado sobre receita.

---

## Integrações (apps, APIs, webhooks) · `/painel/integracoes`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Integrações" em docs/prompts/08-terceiros-integracoes.md. Já existe app/api/integracoes — implemente /painel/integracoes como central de conexões (pagamento, e-mail, WhatsApp, NFS-e, calendário, meteorologia, contabilidade) com chaves, status e webhooks. Nunca exponha segredos no client. Sem "R$" hardcoded.
```

- **NAV:** grupo Conta ou Inteligência. **Objetivo:** central onde o dono conecta serviços externos que as outras páginas consomem — gateway de pagamento (Mercado Pago, já integrado), e-mail (SMTP/nodemailer), **WhatsApp** (Campanhas/Convocação), **NFS-e** (Faturamento), **calendário** (Google/iCal — Reservas), **meteorologia** (Plano B), **contabilidade** (exportar para o contador), **assinatura digital** (Contratos), webhooks de entrada/saída. Catálogo "conecte/desconecte" estilo marketplace.

**Modelo de dados**
- `integracoes`: `id, usuario_id, chave ('mercadopago'|'smtp'|'whatsapp'|'nfse'|'google_calendar'|'openweather'|'zapsign'|...), status ('conectado'|'desconectado'|'erro'), config jsonb (NÃO segredos crus — segredos em env/secret store; aqui só metadados/ids públicos), conectado_em, ultimo_uso, ultimo_erro`.
- `webhooks`: `id, usuario_id, evento ('reserva.criada'|'pagamento.aprovado'|'contrato.assinado'|...), url, secret_ref, ativo`; `webhooks_log` (entregas/retentativas).
- `api_keys` (se expor API própria): chave por dono, escopos, rate limit.

**Seções & funcionalidades**
1. **Catálogo de integrações** (cards "conectar"): cada uma com descrição, status, teste de conexão, e link para onde é usada. Categorias: Pagamento, Comunicação, Fiscal, Agenda, Dados, Assinatura, Contabilidade.
2. **Configuração segura:** formulário por integração; **segredos via env/secret store no servidor** (rota de API guarda; client só vê status/últimos dígitos). Botão "testar conexão".
3. **Webhooks de saída:** assinar eventos do sistema e enviar a uma URL (com secret/assinatura), log de entregas e retentativa.
4. **API/Chaves (avançado):** gerar API key do dono para integrações próprias (Zapier/Make), escopos e limites.
5. **Saúde:** status de cada conexão, último uso, erros recentes, alertas quando uma integração crítica cai (ex.: pagamento).

**Critérios de aceite:** conectar/testar/desconectar por serviço; segredos nunca chegam ao client; webhook entrega com assinatura e re-tenta em falha; status/erros visíveis; cada integração aponta onde é consumida.
