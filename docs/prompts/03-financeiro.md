# 03 — Financeiro & Contábil

Páginas: **Contabilidade completa**, **Faturamento & Notas Fiscais**, **Contas a pagar/receber**, **Comissões**.

> Pré-requisito: leia `00-contexto-base.md`. A página `/painel/financeiro` (cockpit CFO) **já existe** e é o padrão-ouro — estas páginas se conectam a ela via `lancamentos`, `parcelas`, `clientes_eventos`. Não duplique o cockpit; aprofunde o contábil/fiscal.

---

## Contabilidade completa · `/painel/contabilidade`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Contabilidade completa" em docs/prompts/03-financeiro.md, depois implemente /painel/contabilidade (plano de contas, DRE, balancete, fluxo de caixa, conciliação, regime caixa/competência). Reaproveite lancamentos/parcelas; não duplique o cockpit de /painel/financeiro. Sem "R$" hardcoded.
```

- **NAV:** novo grupo "Financeiro" (junto de Financeiro, Recebíveis, Faturamento, Comissões). **Premium:** Pro+.
- **Objetivo:** camada contábil de verdade sobre o caixa: plano de contas estruturado, DRE gerencial, balancete, regime de competência × caixa, centros de custo (por propriedade/evento), conciliação bancária e fechamento mensal. É o que o contador pede.

**Modelo de dados**
- `plano_contas`: `id, usuario_id, codigo ('3.1.01'), nome, tipo ('receita'|'despesa'|'ativo'|'passivo'|'patrimonio'), grupo, dre_linha, ativo`. Seed com um plano padrão para locação de eventos.
- `centros_custo`: `id, usuario_id, nome, tipo ('propriedade'|'evento'|'departamento'|'projeto'), ref_id`.
- Estender `lancamentos`: `conta_id (→plano_contas), centro_custo_id, competencia date (≠ data de caixa), nota_id (→notas_fiscais), conciliado bool, conta_bancaria_id`.
- `contas_bancarias`: `id, usuario_id, nome, banco, tipo, saldo_inicial_num, saldo_atual_num`.
- `conciliacao_extrato`: `id, conta_bancaria_id, data, descricao, valor_num, lancamento_id (match), status`.
- `fechamentos`: `id, usuario_id, mes, status ('aberto'|'fechado'), fechado_em` (trava edição retroativa).

**Seções & funcionalidades**
1. **Plano de contas:** árvore editável (importar/exportar), vincular lançamentos. Seed inteligente para o nicho (receita de locação, taxas, buffet repassado; despesas: pessoal, manutenção, energia, marketing, impostos…).
2. **DRE gerencial** (mês/trim/ano, caixa × competência): Receita bruta → deduções/impostos → receita líquida → custos diretos do evento → margem de contribuição → despesas fixas/administrativas → EBITDA → resultado. Por centro de custo (propriedade/tipo de evento). Comparativo e % vertical/horizontal.
3. **Balancete / razão:** saldos por conta, livro-razão por conta, filtros por período.
4. **Fluxo de caixa:** realizado + projetado (puxa `parcelas` a receber e contas a pagar), por conta bancária, posição consolidada, projeção 12 meses.
5. **Conciliação bancária:** importar OFX/CSV do extrato → matching automático com `lancamentos` (por valor/data) → conciliar/ajustar. Saldo conciliado vs. contábil.
6. **Fechamento mensal:** checklist, trava o mês, gera pacote (DRE + fluxo + razão) em PDF/Excel para o contador.
7. **Impostos:** estimativa por regime (Simples/Presumido — campos configuráveis), provisão.

**Critérios de aceite:** DRE bate com `lancamentos` por competência e por caixa; conciliação faz match e marca conciliado; fechamento trava edição retroativa; export contábil (PDF/XLSX); centros de custo segmentam o DRE.

---

## Faturamento & Notas Fiscais · `/painel/faturamento`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Faturamento & Notas Fiscais" em docs/prompts/03-financeiro.md, depois implemente /painel/faturamento (emissão/gestão de NFS-e e recibos, cobrança e baixa). Integre via provedor (degrade para emissão manual/recibo). Sem "R$" hardcoded.
```

- **NAV:** grupo Financeiro. **Objetivo:** emitir e controlar documentos fiscais (NFS-e de locação/serviço, recibos), vincular ao evento/contrato e ao recebimento, e gerir cobranças. No Brasil, locação de espaço normalmente gera **NFS-e municipal**; permitir também NF-e de produtos (quando revende itens).

**Modelo de dados**
- `notas_fiscais`: `id, usuario_id, tipo ('nfse'|'nfe'|'recibo'), numero, serie, cliente_id, evento_id, contrato_id, valor_servicos_num, descontos_num, iss_num, retencoes jsonb, valor_total_num, discriminacao, status ('rascunho'|'emitida'|'cancelada'|'erro'), emitida_em, xml_url, pdf_url, provedor, provedor_id`.
- `faturas` (cobrança): `id, usuario_id, cliente_id, evento_id, valor_num, vencimento, status, meio ('pix'|'boleto'|'cartao'|'link'), link_pagamento, nota_id, pago_em`.
- `config_fiscal` (por usuario_id): regime, CNAE, código de serviço, alíquota ISS, dados do emitente, credenciais do provedor.

**Seções & funcionalidades**
1. **Emissão de NFS-e:** a partir de um evento/contrato/parcela; preenche tomador (cliente), discriminação, valor, ISS/retidos; emite via provedor (Focus NFe, eNotas, NFe.io, PlugNotas — configurável em Integrações). Degrade: gera **recibo** PDF numerado quando sem provedor.
2. **Cobrança integrada:** gerar fatura/link de pagamento (Mercado Pago — já integrado), boleto/Pix; ao pagar, baixa a `parcela` e cria `lancamento` (regime caixa) automaticamente.
3. **Painel:** faturado no mês, a faturar, impostos a recolher, notas por status, inadimplência. Conciliação nota↔recebimento↔contábil.
4. **Em lote:** emitir notas das parcelas pagas do mês; reenviar; cancelar/substituir.
5. **Arquivo:** guarda XML/PDF (bucket), exporta lote para o contador.

**Critérios de aceite:** emitir gera registro + PDF/recibo e marca a parcela; pagamento via link baixa parcela e cria lançamento; degrade sem provedor (recibo); export do lote fiscal; valores de ISS/retenção corretos conforme config.

---

## Contas a pagar / a receber · `/painel/recebiveis` (estender) + Contas a pagar

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Contas a pagar/receber" em docs/prompts/03-financeiro.md. A rota /painel/recebiveis já existe (a receber) — estenda para incluir Contas a Pagar (fornecedores/folha/recorrências) com aging, agenda e baixa. Sem "R$" hardcoded.
```

- **NAV:** grupo Financeiro (já existe Recebíveis). **Objetivo:** gestão completa de AP/AR — a receber (parcelas de eventos) e **a pagar** (fornecedores, folha, recorrências, impostos), com aging, agenda de vencimentos, conciliação e baixa que reflete no caixa/contábil.

**Modelo de dados**
- A receber: `parcelas` (já existe). Garantir `vencimento, status, pago_em, evento_id, meio`.
- `contas_pagar`: `id, usuario_id, fornecedor_id (→fornecedores), categoria, conta_id (→plano_contas), descricao, valor_num, vencimento, status ('pendente'|'pago'|'atrasado'|'agendado'), pago_em, meio, recorrente bool, recorrencia jsonb, anexo_url, ordem_compra_id`.

**Seções & funcionalidades**
1. **Visão unificada:** posição (a receber × a pagar × saldo projetado), aging real (0–30/31–60/61–90/90+), próximos 7/30 dias, inadimplência (receber) e em atraso (pagar).
2. **A receber:** lista de parcelas, baixa (vira `lancamento`), régua de cobrança (lembrete antes do vencimento + cobrança após — integra Campanhas/E-mail), renegociação/parcelamento.
3. **A pagar:** cadastro (vinculado a Compras/Fornecedores/Folha), recorrências (aluguel, energia, software), agenda de pagamento, aprovação (alçada), comprovante (anexo), baixa.
4. **Agenda/calendário** de vencimentos; exportar; conciliação com contábil.

**Critérios de aceite:** aging correto; baixa de pagar/receber gera lançamento no caixa; recorrência gera próximas contas; régua de cobrança dispara; contas vencidas viram "atrasado" via cron.

---

## Comissões · `/painel/comissoes`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Comissões" em docs/prompts/03-financeiro.md, depois implemente /painel/comissoes (regras de comissão de vendedores/parceiros/indicações, apuração e pagamento). Sem "R$" hardcoded.
```

- **NAV:** grupo Financeiro. **Objetivo:** calcular e gerir comissões de quem traz/fecha negócio: vendedores internos (equipe), agências/promotores, e indicações de clientes (liga com `/painel/indique`). Locação de eventos vive de indicação e de cerimonialistas/agências que trazem clientes.

**Modelo de dados**
- `comissoes_regras`: `id, usuario_id, beneficiario_tipo ('equipe'|'parceiro'|'cliente'), beneficiario_id, base ('valor_evento'|'margem'|'fixo'), percentual, valor_fixo_num, condicao jsonb (tipo de evento, propriedade, faixa), vigencia, ativo`.
- `comissoes`: `id, usuario_id, regra_id, beneficiario_tipo, beneficiario_id, evento_id, base_num, valor_num, status ('prevista'|'apurada'|'aprovada'|'paga'|'cancelada'), competencia, pago_em, conta_pagar_id`.
- `parceiros`: `id, usuario_id, nome, tipo ('agencia'|'cerimonial'|'promotor'|'afiliado'), doc, contato, percentual_padrao`.

**Seções & funcionalidades**
1. **Regras:** por beneficiário/condição (ex.: vendedor 3% do valor, cerimonialista 10% sobre locação de casamento, indicação R$ X). Camadas/escalonamento por meta.
2. **Apuração:** ao fechar/pagar um evento, gera comissão prevista → apurada (quando recebido) → aprovada → paga (vira conta a pagar). Painel por beneficiário/mês.
3. **Extrato do parceiro:** o que tem a receber, histórico, comprovantes; link/portal opcional.
4. **Relatórios:** custo de comissão sobre receita, ranking de parceiros por receita gerada (liga com Marketing/ROI), comissão sobre margem.

**Critérios de aceite:** comissão calcula pela regra correta no fechamento; só vira "paga" gerando conta a pagar; estorna se evento cancelado; ranking de parceiros e custo % corretos.
