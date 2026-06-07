# 04 — Suprimentos & Patrimônio

Páginas: **Fornecedores**, **Compras**, **Estoque/Almoxarifado**, **Ativos & Bens**, **Equipamentos & Locação de itens**, **Manutenção & Ordens de Serviço**.

> Pré-requisito: leia `00-contexto-base.md`. Fluxo: Fornecedores → Compras (requisição→cotação→pedido→entrega) → Estoque → consumo no evento. Patrimônio (Ativos/Equipamentos) e Manutenção cuidam do que a empresa possui.

---

## Fornecedores · `/painel/fornecedores`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Fornecedores" em docs/prompts/04-suprimentos.md, depois implemente /painel/fornecedores (cadastro 360º, avaliação, histórico de compras, documentos). Sem "R$" hardcoded.
```

- **NAV:** novo grupo "Suprimentos". **Objetivo:** base de fornecedores e prestadores recorrentes (buffet, som, segurança, decoração, locação de tendas/banheiros químicos, gráfica, bebidas), com avaliação de desempenho, histórico de compras/contratos, condições e documentos. Distinto de **Terceiros** (que mede custo×retorno macro) — aqui é o cadastro operacional.

**Modelo de dados**
- `fornecedores`: `id, usuario_id, tipo ('pf'|'pj'), nome, fantasia, doc, categoria ('buffet'|'som'|'seguranca'|'decoracao'|'locacao'|'limpeza'|'bebidas'|'estrutura'|...), contato, email, telefone, whatsapp, endereco, cidade, estado, condicoes_pagamento, prazo_entrega_dias, chave_pix, banco jsonb, avaliacao_media, ativo, obs, criado_em`.
- `fornecedores_contatos` (vários contatos por fornecedor), `fornecedores_avaliacoes` (`id, fornecedor_id, evento_id, nota, criterios jsonb, comentario`), `fornecedores_docs` (contrato, certidões, alvará — vence em `validade`).

**Seções & funcionalidades**
1. **Lista/cards** com filtro por categoria/cidade/avaliação/ativo; KPIs: total, por categoria, gasto YTD por fornecedor, avaliação média, docs vencidos.
2. **Ficha:** dados + condições + **histórico** (compras, pedidos, contratos, valor total gasto) + **avaliações** (qualidade, prazo, preço, atendimento) + **documentos** com alerta de vencimento + contatos.
3. **Homologação:** status (homologado/em análise/bloqueado) com checklist de documentos.
4. **Comparação:** ranking por categoria (preço × avaliação) para decisão de compra.
5. **Ações:** novo, importar, criar requisição/cotação a partir do fornecedor, registrar avaliação pós-evento.

**Critérios de aceite:** gasto total por fornecedor puxa de Compras/Contas a pagar; docs vencidos alertam; avaliação média recalcula; criar cotação pré-seleciona o fornecedor.

---

## Compras · `/painel/compras`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Compras" em docs/prompts/04-suprimentos.md, depois implemente /painel/compras (fluxo requisição → cotação → pedido → recebimento → financeiro). Sem "R$" hardcoded.
```

- **NAV:** grupo Suprimentos. **Objetivo:** processo completo de compras/contratações com aprovação por alçada, cotação entre fornecedores, pedido, recebimento (que dá entrada no estoque) e geração de conta a pagar. Pensar grande: comprar para um evento de 5 mil pessoas (estrutura, bebida, descartáveis) é um projeto.

**Modelo de dados**
- `requisicoes`: `id, usuario_id, solicitante, evento_id, centro_custo_id, justificativa, prioridade, status ('aberta'|'aprovada'|'reprovada'|'em_cotacao'|'pedido'|'recebida'), criado_em`.
- `requisicao_itens`: `id, requisicao_id, produto_id (→estoque, opcional), descricao, quantidade, unidade, valor_estimado_num`.
- `cotacoes`: `id, requisicao_id, fornecedor_id, valor_total_num, prazo, condicao, anexo_url, escolhida bool, criado_em`.
- `cotacao_itens`: preço por item por fornecedor (mapa comparativo).
- `pedidos_compra`: `id, usuario_id, requisicao_id, cotacao_id, fornecedor_id, numero, valor_total_num, status ('emitido'|'parcial'|'recebido'|'cancelado'), previsao_entrega, criado_em`.
- `recebimentos`: `id, pedido_id, data, itens jsonb (qtd recebida, conformidade), nota_fornecedor, divergencia, conta_pagar_id`.

**Seções & funcionalidades**
1. **Requisição:** quem precisa de quê (liga a evento/centro de custo), itens, prioridade → aprovação por alçada (limite de valor por papel).
2. **Cotação:** disparar para N fornecedores (e-mail com itens), receber/registrar propostas, **mapa comparativo** (item × fornecedor, melhor preço/prazo destacado), escolher.
3. **Pedido de compra:** gerar PO em PDF, enviar ao fornecedor, acompanhar status e previsão.
4. **Recebimento:** conferência (qtd/qualidade), divergências, **entrada automática no Estoque**, e **criação da conta a pagar** (Financeiro).
5. **Painel:** gasto por categoria/evento/fornecedor, lead time médio, economia obtida (estimado vs. comprado), pedidos pendentes.

**Critérios de aceite:** alçada bloqueia aprovação acima do limite; mapa comparativo destaca melhor opção; recebimento dá entrada no estoque e gera conta a pagar; rastro requisição→pedido→recebimento→pagamento.

---

## Estoque / Almoxarifado · `/painel/estoque`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Estoque" em docs/prompts/04-suprimentos.md, depois implemente /painel/estoque (saldo, movimentações, mínimos, lotes/validade, consumo por evento). Sem "R$" hardcoded.
```

- **NAV:** grupo Suprimentos. **Objetivo:** controlar insumos consumíveis e descartáveis (bebidas, alimentos, descartáveis, material de limpeza, papelaria, brindes), com saldo em tempo real, mínimos, validade/lote, e baixa por consumo do evento.

**Modelo de dados**
- `produtos`: `id, usuario_id, sku, nome, categoria, unidade, estoque_minimo, estoque_atual, custo_medio_num, local ('almoxarifado'|'bar'|'cozinha'|...), perecivel bool, ativo`.
- `estoque_mov`: `id, usuario_id, produto_id, tipo ('entrada'|'saida'|'ajuste'|'perda'|'transferencia'), quantidade, custo_unit_num, motivo, evento_id, recebimento_id, lote, validade, criado_em`.
- `inventarios`: `id, usuario_id, data, status, itens jsonb (contado×sistema), ajustes`.

**Seções & funcionalidades**
1. **Saldo atual:** lista com busca/categoria/local, semáforo de mínimo (abaixo do mínimo em vermelho), valor total do estoque (custo médio), perecíveis a vencer.
2. **Movimentações:** entrada (manual ou via Recebimento de Compras), saída (consumo por evento — vincula `evento_id`), ajuste/perda, transferência entre locais. Kardex por produto.
3. **Reposição:** sugestão de compra dos itens abaixo do mínimo → gera Requisição em Compras.
4. **Validade/lote:** alerta de vencimento (FEFO), perdas.
5. **Inventário:** contagem cíclica, ajuste com motivo, relatório de acuracidade.
6. **Custo:** custo médio móvel; consumo por evento alimenta o **custo direto** do evento na Contabilidade.

**Critérios de aceite:** saldo move a cada entrada/saída; abaixo do mínimo sugere compra; consumo por evento aparece no custo do evento; FEFO alerta validade; inventário ajusta com rastro.

---

## Ativos & Bens (patrimônio) · `/painel/ativos`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Ativos & Bens" em docs/prompts/04-suprimentos.md, depois implemente /painel/ativos (patrimônio: imóveis, móveis, equipamentos, veículos — com depreciação, localização, garantia, manutenção). Sem "R$" hardcoded.
```

- **NAV:** grupo Suprimentos/Patrimônio. **Objetivo:** inventário patrimonial — saber exatamente o que a empresa possui: imóveis, móveis, equipamentos de som/luz/cozinha, mobiliário (mesas, cadeiras), veículos, estruturas (tendas, palcos, arquibancadas), com valor, depreciação, localização, garantia, seguro e histórico de manutenção.

**Modelo de dados**
- `ativos`: `id, usuario_id, codigo/patrimonio, nome, categoria ('imovel'|'movel'|'equipamento'|'veiculo'|'estrutura'|'ti'|...), propriedade_id (onde fica), descricao, num_serie, fornecedor_id, data_aquisicao, valor_aquisicao_num, vida_util_meses, metodo_deprec ('linear'), valor_residual_num, valor_atual_num, estado ('novo'|'bom'|'regular'|'ruim'|'baixado'), localizacao, responsavel, garantia_ate, seguro_id, foto_url, qrcode, ativo`.
- `ativos_mov`: movimentação/transferência/baixa; `ativos_manutencao` (liga com OS).

**Seções & funcionalidades**
1. **Inventário:** grid/tabela com filtro por categoria/propriedade/estado; KPIs: valor total do patrimônio, depreciação acumulada, valor contábil atual, itens em manutenção, garantias a vencer.
2. **Ficha do ativo:** dados, foto, **QR code** (etiqueta para imprimir e colar no bem), localização atual, responsável, histórico de manutenção, documentos (nota, manual, garantia, apólice).
3. **Depreciação:** cálculo linear automático mensal (alimenta a Contabilidade — despesa de depreciação); relatório.
4. **Movimentação:** transferir entre propriedades/locais, atribuir responsável, baixa (venda/perda/sucateamento) com resultado.
5. **Manutenção & garantia:** abrir OS (link Manutenção), alertas de garantia/seguro vencendo, custo de manutenção acumulado por ativo (decisão repor×consertar).
6. **Conciliação física:** inventário por QR (bipar e conferir).

**Critérios de aceite:** depreciação mensal correta e lançada no contábil; QR gera etiqueta; transferência mantém rastro; custo de manutenção por ativo somado; garantias/seguros alertam.

---

## Equipamentos & Locação de itens · `/painel/equipamentos`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Equipamentos & Locação de itens" em docs/prompts/04-suprimentos.md, depois implemente /painel/equipamentos (itens locáveis/alocáveis a eventos: mesas, cadeiras, tendas, som, palco — disponibilidade e reserva). Sem "R$" hardcoded.
```

- **NAV:** grupo Suprimentos. **Objetivo:** gerir itens que são **alocados/locados por evento** (mesa, cadeira, toalha, tenda, palco, som, gerador, arquibancada, banheiro químico). Diferente de Ativos (registro patrimonial) e de Estoque (consumível): aqui importa **quantidade disponível por data** e **reserva por evento** (sai e volta). Pode ser próprio ou sublocado de fornecedor.

**Modelo de dados**
- `equipamentos`: `id, usuario_id, nome, categoria ('mobiliario'|'estrutura'|'som_luz'|'cozinha'|'sanitario'|'energia'|...), quantidade_total, proprio bool, fornecedor_id (se sublocado), custo_locacao_num, preco_locacao_num (se aluga ao cliente), ativo`.
- `equipamentos_alocacao`: `id, equipamento_id, evento_id, reserva_id, quantidade, inicio, fim, status ('reservado'|'separado'|'em_uso'|'devolvido'|'avariado'), obs`.

**Seções & funcionalidades**
1. **Inventário locável:** quantidade total, **disponível por data** (total − alocado no período), próprio × sublocado.
2. **Disponibilidade:** calendário/timeline de uso por item; impede alocar mais do que existe (gera necessidade de sublocação → vira Requisição/Compra ao fornecedor).
3. **Romaneio do evento:** monta a lista de itens de um evento (puxa de pacotes/proposta), separação (picking), saída e **devolução** (conferência, avarias → baixa/manutenção).
4. **Locação ao cliente:** itens com `preco_locacao` entram no orçamento/proposta automaticamente; receita de locação de itens.
5. **Custos:** custo de sublocação por evento (alimenta custo do evento); itens mais rentáveis.

**Critérios de aceite:** disponível por data correto; superalocação bloqueada e sugere sublocação; romaneio saída/devolução com avaria; receita/custo de itens reflete no evento.

---

## Manutenção & Ordens de Serviço · `/painel/manutencao`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Manutenção & Ordens de Serviço" em docs/prompts/04-suprimentos.md, depois implemente /painel/manutencao (manutenção preventiva/corretiva de espaços e ativos, OS, custos). Sem "R$" hardcoded.
```

- **NAV:** grupo Suprimentos (ou Operações). **Objetivo:** manter espaços e ativos funcionando: ordens de serviço corretivas (quebrou) e preventivas (plano periódico — ar-condicionado, gerador, elétrica, jardim, piscina, estrutura), com custo, responsável (interno/fornecedor) e histórico. Crítico para grandes estruturas (arena, galpão, autódromo).

**Modelo de dados**
- `manutencao_os`: `id, usuario_id, propriedade_id, ativo_id, tipo ('preventiva'|'corretiva'|'inspecao'|'melhoria'), titulo, descricao, prioridade ('baixa'|'media'|'alta'|'urgente'), status ('aberta'|'planejada'|'em_andamento'|'aguardando_peca'|'concluida'|'cancelada'), solicitante, responsavel ('equipe'|'fornecedor'), responsavel_id, abertura, prazo, conclusao, custo_mao_obra_num, custo_pecas_num, custo_total_num, anexos, criado_em`.
- `manutencao_planos`: `id, usuario_id, ativo_id/propriedade_id, titulo, periodicidade ('diaria'|'semanal'|'mensal'|'trimestral'|'anual'|'horas_uso'), proxima_data, checklist jsonb, ativo` (gera OS automática).

**Seções & funcionalidades**
1. **Quadro de OS** (Kanban por status) + lista; filtros por propriedade/tipo/prioridade/responsável; KPIs: abertas, atrasadas, MTTR, custo do mês, top ativos que mais custam.
2. **Abrir OS:** corretiva (com foto), vincular ativo/espaço, atribuir interno/fornecedor, peças (puxa Estoque/Compras), custo, prazo.
3. **Preventiva:** planos com periodicidade/checklist → geram OS automaticamente na data; calendário de manutenção; "antes do evento X, checar gerador/ar/elétrica".
4. **Pré-evento checklist:** vincular checklist de manutenção a uma reserva (garantir que tudo funciona antes do evento).
5. **Custos & decisão:** custo acumulado por ativo/espaço (consertar × repor — liga com Ativos), peças mais usadas.

**Critérios de aceite:** preventiva gera OS na data; OS consome peças do estoque e soma custo; custo de manutenção entra no contábil e por ativo; checklist pré-evento bloqueia "ok" sem itens marcados; MTTR/atrasadas corretos.
