# 06 — Operações de Evento (o diferencial do nicho)

Páginas: **Produção & Run-of-show**, **Logística (montagem/desmontagem)**, **Segurança, Acesso & Credenciamento**, **Estacionamento & Mobilidade**, **Ingressos & Bilheteria**, **Expositores & Patrocínios**, **Catering, Buffet & Bar**, **Layouts, Plantas & Capacidade**, **Clima & Plano B**.

> Pré-requisito: leia `00-contexto-base.md`. Este módulo é o que diferencia a Ventsy de um CRM genérico. **Pense grande:** o mesmo motor serve festa de igreja, vaquejada/hípica, corrida de rua, track day/exposição de carros, air show/fly-in, feira agro, congresso, show. Cada página abaixo lista como escala do pequeno ao gigante.

> Sugestão de NAV: criar o grupo **"Operações"** no `layout.tsx` para estas páginas.

---

## Produção & Run-of-show · `/painel/producao`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Produção & Run-of-show" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/producao (gestão de produção do evento: checklist, cronograma minuto-a-minuto, responsáveis, briefing). Sem "R$" hardcoded.
```

- **Objetivo:** transformar um evento contratado num **projeto executável**: briefing, checklist de produção, cronograma operacional (run-of-show minuto-a-minuto), responsáveis, fornecedores e marcos. É o "dia D sob controle".
- **Escala:** casamento (timeline da cerimônia→festa) · corrida (largada, pelotões, premiação) · air show (janelas de voo, NOTAM) · feira (abertura, palestras, credenciamento) · show (passagem de som, portões, headliner).

**Modelo de dados**
- `producao` (1:1 com evento): `id, usuario_id, evento_id, status ('planejamento'|'pronto'|'em_execucao'|'encerrado'), briefing jsonb, observacoes`.
- `producao_tarefas`: `id, producao_id, titulo, categoria ('comercial'|'logistica'|'AeB'|'tecnico'|'seguranca'|'limpeza'|...), responsavel ('equipe'|'fornecedor'|'cliente'), responsavel_id, prazo, status, depende_de, anexos`.
- `runshow`: `id, producao_id, horario, duracao_min, atividade, area/espaco, responsavel, recurso (som/luz/palco), obs` (linha do tempo).
- `briefing_templates` por tipo de evento.

**Seções & funcionalidades**
1. **Briefing:** formulário rico por tipo de evento (nº convidados, horários, cardápio, layout, contatos-chave, do's & don'ts, contatos de emergência). Cliente pode preencher pelo Portal.
2. **Checklist de produção** (Kanban ou lista por categoria) com responsável/prazo/dependência; templates por tipo de evento; % de prontidão; pendências críticas.
3. **Run-of-show:** cronograma minuto-a-minuto (timeline visual), por área/espaço, com responsáveis e recursos; exportável (PDF para a equipe), modo "dia do evento" (tela grande/mobile, marca concluído).
4. **Equipe & fornecedores do evento:** quem está alocado (puxa Ponto/Escala), contatos, ordens de serviço.
5. **Pós-evento:** checklist de encerramento, devolução de equipamentos, feedback, lições aprendidas.

**Critérios de aceite:** template gera checklist + run-show por tipo de evento; modo dia-do-evento usável no celular; dependências bloqueiam ordem; integra equipe (Ponto) e fornecedores; PDF do roteiro.

---

## Logística: Montagem & Desmontagem · `/painel/logistica`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Logística" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/logistica (janelas de montagem/desmontagem, recebimento de fornecedores, carga/descarga, frota, cronograma físico). Sem "R$" hardcoded.
```

- **Objetivo:** orquestrar o físico antes/depois do evento: janelas de montagem e desmontagem (que ocupam o espaço além do evento em si — refletir em Reservas), agenda de chegada de fornecedores (buffet, som, estrutura), docas/carga-descarga, frota e roteiros. Em evento grande (feira, festival, autódromo) a montagem dura dias.

**Modelo de dados**
- `logistica_janelas`: `id, usuario_id, evento_id, reserva_id, tipo ('montagem'|'desmontagem'|'ensaio'|'limpeza'), inicio, fim, espaco_id` (bloqueia o espaço em Reservas).
- `logistica_chegadas`: `id, evento_id, fornecedor_id, item, previsto, doca/portao, responsavel, status ('agendado'|'chegou'|'montado'|'saiu')`.
- `frota`: `id, usuario_id, tipo, placa, capacidade, motorista, status`; `frota_viagens` (roteiros).

**Seções & funcionalidades**
1. **Cronograma físico:** linha do tempo do evento incluindo montagem→evento→desmontagem; reflete bloqueios no Calendário (o espaço fica indisponível na janela).
2. **Agenda de fornecedores:** quem chega quando, por qual portão/doca, o que traz, contato; checklist de recebimento.
3. **Carga & descarga:** controle de docas/portões (evita congestionamento), ordem de entrada, credencial de veículo de fornecedor.
4. **Frota própria:** veículos, motoristas, roteiros de transporte de material (liga com Ativos).
5. **Mapa logístico:** rotas internas, pontos de montagem (liga com Layouts).

**Critérios de aceite:** janela de montagem/desmontagem bloqueia o espaço em Reservas; agenda de chegadas evita choque de docas; credencial de veículo de fornecedor; cronograma físico integrado ao run-show.

---

## Segurança, Acesso & Credenciamento · `/painel/acesso`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Segurança, Acesso & Credenciamento" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/acesso (credenciamento, QR check-in, controle de capacidade em tempo real, listas, segurança). Sem "R$" hardcoded.
```

- **Objetivo:** controlar quem entra: credenciamento (convidados, equipe, fornecedores, imprensa, VIP), check-in por QR, **lotação em tempo real** vs. capacidade autorizada (segurança/bombeiros), listas e zonas de acesso. Vale para festa fechada (lista de convidados) e evento aberto (milhares — corrida, show, feira).

**Modelo de dados**
- `credenciais`: `id, usuario_id, evento_id, tipo ('convidado'|'equipe'|'fornecedor'|'imprensa'|'vip'|'atleta'|'expositor'|'piloto'), nome, doc, categoria_ingresso_id (se pago), qr_token, zonas text[], status ('emitida'|'checkin'|'checkout'|'bloqueada'), foto_url`.
- `acesso_eventos_log`: `id, credencial_id, evento_id, ponto ('portao_a'|...), direcao ('entrada'|'saida'), criado_em` (para lotação em tempo real).
- `zonas`: áreas com capacidade (palco, camarote, pista, arquibancada) e regra de acesso por tipo de credencial.

**Seções & funcionalidades**
1. **Credenciamento:** importar/gerar credenciais (de convidados do Portal, de ingressos da Bilheteria, de equipe/fornecedores), com QR; impressão de crachá/pulseira; categorias e zonas.
2. **Check-in/out (modo portaria):** tela de leitura de QR (câmera/coletor) rápida, valida zona/duplicidade, registra entrada/saída; offline-tolerante.
3. **Lotação em tempo real:** painel com público presente × **capacidade autorizada** por zona e total; alerta ao aproximar do limite (compliance bombeiros). Histórico de pico.
4. **Listas:** convidados (RSVP do Portal), VIPs, "lista de bloqueio", autoridades.
5. **Segurança:** plano de posições (liga com Escala — seguranças/brigadistas), rondas, registro de ocorrências, achados e perdidos, contatos de emergência (liga com SST).

**Critérios de aceite:** QR único por credencial, anti-duplicidade; lotação em tempo real por zona com alerta de capacidade; check-in puxa de convidados/ingressos/equipe; crachá/pulseira imprimível; ocorrências registradas.

---

## Estacionamento & Mobilidade · `/painel/estacionamento`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Estacionamento & Mobilidade" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/estacionamento (vagas, setores, controle de entrada, valet, receita, ônibus/transfer). Sem "R$" hardcoded.
```

- **Objetivo:** gerir estacionamento e mobilidade do evento — capacidade de vagas por setor, controle de entrada/saída, valet, receita de estacionamento, e transporte (vans/ônibus/transfer/shuttle). Eventos grandes (feira agro, autódromo, corrida) têm milhares de carros, ônibus de excursão e até heliponto/pista (air show).

**Modelo de dados**
- `estacionamento_setores`: `id, usuario_id, propriedade_id, nome, tipo ('carro'|'moto'|'onibus'|'caminhao'|'van'|'credenciado'|'pcd'|'heliponto'), capacidade, preco_num`.
- `estacionamento_acessos`: `id, evento_id, setor_id, placa, tipo, entrada, saida, valor_num, credencial_id, status`.
- `transfer`: `id, evento_id, tipo ('shuttle'|'van'|'onibus'), rota, horarios jsonb, capacidade, fornecedor_id`.

**Seções & funcionalidades**
1. **Setores & capacidade:** mapa/lista de setores com lotação atual × capacidade; preço por setor; vagas PCD/idoso obrigatórias.
2. **Controle de acesso veicular:** registro por placa/QR (credenciado grátis × pagante), tempo de permanência, receita; integra com Acesso (credencial de veículo).
3. **Valet:** fila, chaves, localização, cobrança.
4. **Receita:** faturamento de estacionamento por evento (entra no financeiro do evento), por setor, ticket médio.
5. **Mobilidade:** transfers/shuttles (rotas, horários, capacidade, fornecedor), pontos de embarque (liga com Layouts), orientação de tráfego e plano de fluxo.

**Critérios de aceite:** lotação por setor em tempo real; credenciado não paga; receita de estacionamento entra no evento; PCD reservadas; transfers com horários/capacidade.

---

## Ingressos & Bilheteria · `/painel/bilheteria`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Ingressos & Bilheteria" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/bilheteria (eventos com venda de ingressos: lotes, categorias, cupons, venda online, QR, financeiro). Use Mercado Pago (já integrado). Sem "R$" hardcoded.
```

- **Objetivo:** vender ingressos para eventos que o próprio espaço promove ou hospeda com bilhetagem — corrida de rua (inscrição + kit), exposição de carros, vaquejada/rodeio, air show, show, festa de igreja com convite pago, feira (ingresso + credencial). Lotes, categorias, cupons, meia-entrada, venda online, QR para check-in (liga com Acesso) e prestação de contas.

**Modelo de dados**
- `bilheteria_eventos`: `id, usuario_id, evento_id, propriedade_id, titulo, descricao, capacidade, venda_inicio, venda_fim, pagina_token, status, taxa_servico`.
- `ingressos_categorias`: `id, bilheteria_id, nome ('Pista'|'Camarote'|'Inscrição 5k'|'Meia'|'Criança'|'Mesa'...), preco_num, quantidade, lote, vendido, por_pessoa, kit jsonb (corrida)`.
- `cupons`: `id, bilheteria_id, codigo, tipo ('percentual'|'fixo'), valor, limite, usados, validade` (pode reusar `app/api`/cupons admin existente).
- `ingressos`: `id, categoria_id, comprador_nome, comprador_doc, email, qr_token, valor_num, status ('reservado'|'pago'|'cancelado'|'checkin'), pedido_id, criado_em`.
- `pedidos_ingresso`: pagamento (Mercado Pago), múltiplos ingressos.

**Seções & funcionalidades**
1. **Configurar venda:** categorias/lotes (preço sobe por lote/data), capacidade, meia-entrada, cupons, taxa de serviço, campos extras (tamanho de camiseta para corrida, modelo do carro para exposição, registro ANAC para fly-in).
2. **Página pública de venda** (`(public)/ingressos/[token]`): seleção, checkout via Mercado Pago (Pix/cartão), e-mail com ingresso + QR.
3. **Gestão:** vendas em tempo real (por categoria/lote/canal), receita, repasses/taxas, mapa de lotação, cortesias, reembolso/cancelamento, transferência de titularidade.
4. **Check-in:** QR do ingresso vira credencial (integra `/painel/acesso`); kit de corrida (entrega na retirada).
5. **Financeiro:** receita de bilheteria → financeiro do evento; conciliação Mercado Pago; repasse a produtores/patrocínio.

**Escala:** festa de igreja (convite simples) → corrida 5k (inscrição+kit+categorias por idade/PCD) → air show (ingresso + estacionamento + camarote) → festival (lotes, cupons, milhares).

**Critérios de aceite:** lotes esgotam por quantidade; checkout Mercado Pago paga e emite QR; meia/cupom aplicam; check-in integra Acesso; receita cai no financeiro; campos extras por tipo (camiseta, carro, ANAC).

---

## Expositores & Patrocínios · `/painel/expositores`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Expositores & Patrocínios" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/expositores (feiras/expos: venda de estandes, cotas de patrocínio, mapa de estandes, contratos, entregáveis). Sem "R$" hardcoded.
```

- **Objetivo:** monetizar feiras, exposições e eventos com marcas: venda de **estandes** (mapa, metragem, preço por ponto) e **cotas de patrocínio** (ouro/prata/bronze com entregáveis), gestão de contratos, faturamento e entregáveis (logo no palco, post, estande montado). Feira agro, exposição de carros, congresso, festival com patrocinadores.

**Modelo de dados**
- `expo_mapa`: estandes — `id, usuario_id, evento_id, codigo, area_m2, tipo, preco_num, posicao jsonb (x,y no mapa), status ('disponivel'|'reservado'|'vendido'|'bloqueado'), expositor_id`.
- `expositores`: `id, usuario_id, evento_id, empresa, contato, doc, estande_id, contrato_id, valor_num, status, necessidades jsonb (energia, internet, montagem)`.
- `patrocinio_cotas`: `id, usuario_id, evento_id, nome ('Master'|'Ouro'|...), preco_num, quantidade, vendidas, entregaveis jsonb`.
- `patrocinadores`: `id, evento_id, cota_id, marca, contato, valor_num, contrato_id, entregaveis_status jsonb`.

**Seções & funcionalidades**
1. **Mapa de estandes** (visual, clicável — SVG/leaflet): vender/reservar/bloquear; cor por status; metragem e preço.
2. **Expositores:** cadastro, contrato (liga com Contratos), necessidades técnicas (energia/internet/montagem → vira tarefa em Logística), credenciais (→ Acesso), faturamento (→ Financeiro/Faturamento).
3. **Patrocínio:** cotas com entregáveis e preço; pipeline de venda; controle de entrega de cada item (checklist por patrocinador); relatório de contrapartidas para a marca.
4. **Receita:** faturamento de estandes + patrocínio por evento; metas de comercialização; % do mapa vendido.

**Critérios de aceite:** mapa de estandes vende/bloqueia visualmente; expositor gera contrato+fatura+credencial; necessidades viram tarefas de logística; entregáveis de patrocínio com checklist; receita no financeiro do evento.

---

## Catering, Buffet & Bar · `/painel/catering`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Catering, Buffet & Bar" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/catering (cardápios, A&B por evento, consumo, bar/open bar, custo por prato/pessoa). Liga com Estoque. Sem "R$" hardcoded.
```

- **Objetivo:** gerir alimentos & bebidas do evento — cardápios e pacotes, dimensionamento por nº de convidados, restrições alimentares, controle de bar/open bar, consumo (puxa Estoque) e custo por prato/pessoa (CMV). Vale para buffet próprio, food festival, bar de show, café de congresso.

**Modelo de dados**
- `cardapios`: `id, usuario_id, nome, tipo ('coquetel'|'jantar'|'buffet'|'coffee'|'churrasco'|...), itens jsonb (prato, porção/pessoa, custo, preço), preco_pessoa_num`.
- `catering_evento`: `id, evento_id, cardapio_id, convidados int, restricoes jsonb, ajustes, custo_previsto_num, receita_num`.
- `bar_evento`: `id, evento_id, tipo ('open_bar'|'consumacao'|'cash_bar'), drinks jsonb, consumo jsonb, perdas`.
- Liga com `produtos`/`estoque_mov` (insumos) e `fornecedores` (catering terceirizado).

**Seções & funcionalidades**
1. **Cardápios & pacotes:** montar cardápios com custo/preço por pessoa (entra na Proposta/Precificação); ficha técnica (ingredientes → Estoque).
2. **Dimensionamento:** por nº de convidados calcula quantidades (carne/pessoa, bebida/pessoa, gelo, descartáveis) e gera **lista de compras/requisição** (→ Compras).
3. **Restrições:** veg/vegano/sem glúten/kosher/halal/infantil (puxa de convidados no Portal).
4. **Bar:** open bar × consumação × cash bar; cardápio de drinks; controle de consumo e perdas; ficha por convidado/ficha de consumação.
5. **Custo (CMV):** custo de A&B por evento e por pessoa, food cost %, comparação previsto×real (consumo do Estoque), itens mais rentáveis.

**Critérios de aceite:** dimensionamento gera requisição de compras correta; consumo baixa Estoque e calcula CMV real; cardápio alimenta a proposta; restrições agregadas dos convidados; previsto×real de A&B.

---

## Layouts, Plantas & Capacidade · `/painel/layouts`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Layouts, Plantas & Capacidade" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/layouts (plantas dos espaços, setups por tipo, capacidade por arranjo, mapa de mesas). Sem "R$" hardcoded.
```

- **Objetivo:** documentar e planejar o uso físico do espaço: plantas, **setups** (auditório, banquete, escolar, U, coquetel, pista) com **capacidade por arranjo**, mapa de mesas/lugares, posicionamento de palco/bar/estandes. Ajuda a vender (cliente visualiza) e a operar (equipe monta).

**Modelo de dados**
- `layouts`: `id, usuario_id, propriedade_id, espaco_id, nome, tipo_setup, capacidade, planta_url (imagem), elementos jsonb (mesas, palco, bar, banheiros — posição/tamanho), criado_em`.
- `evento_layout`: `id, evento_id, layout_id, mapa_mesas jsonb (mesa→convidados), ajustes`.

**Seções & funcionalidades**
1. **Biblioteca de plantas** por espaço: upload de planta + capacidade por tipo de setup (mesma sala: 200 banquete / 350 auditório / 500 coquetel).
2. **Editor de layout** (canvas SVG simples): arrastar mesas/palco/bar/pista/estandes; calcula capacidade e checa folga/circulação; salva por evento.
3. **Mapa de mesas:** alocar convidados (do Portal) a mesas, ver ocupação, restrições (juntar/separar), exportar para a recepção/credenciamento.
4. **Capacidade & compliance:** capacidade autorizada (liga com Licenças/Acesso) por arranjo; densidade (m²/pessoa).
5. **Compartilhar:** enviar layout ao cliente (Portal/Proposta) e à equipe (Produção).

**Critérios de aceite:** capacidade por setup correta; editor salva elementos por evento; mapa de mesas aloca convidados e exporta; capacidade conversa com Acesso (lotação) e Licenças.

---

## Clima & Plano B (outdoor) · `/painel/plano-b`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Clima & Plano B" em docs/prompts/06-operacoes-eventos.md, depois implemente /painel/plano-b (previsão do tempo por evento outdoor, gatilhos e planos de contingência, comunicação). Sem "R$" hardcoded.
```

- **Objetivo:** reduzir o risco de eventos ao ar livre — previsão do tempo para a data/local, **gatilhos** (se chuva/vento/calor acima de X → aciona plano B: cobertura, remarcação, área interna alternativa), checklist de contingência e comunicação a cliente/equipe/público. Essencial para corrida, vaquejada, air show (vento/teto), exposição de carros, casamento no jardim, festa de igreja.

**Modelo de dados**
- `plano_contingencia`: `id, usuario_id, evento_id, tipo_risco ('chuva'|'vento'|'calor'|'frio'|'tempestade'|'baixa_visibilidade'), gatilho jsonb (limiar), acao, responsavel, status, comunicado_template`.
- `clima_snapshots`: `id, evento_id, fonte, previsao jsonb, capturado_em` (cache de previsão).

**Seções & funcionalidades**
1. **Previsão por evento:** integra API de meteorologia (Open-Meteo/INMET/OpenWeather — configurável; degrade para entrada manual) usando data + lat/long da propriedade; mostra previsão horária no dia, chance de chuva, vento, índice UV, nascer/pôr do sol.
2. **Gatilhos & planos:** definir limiares por risco e ação (acionar tenda, mover para galpão, remarcar, encurtar). Painel de risco por evento (verde/amarelo/vermelho).
3. **Checklist de contingência:** itens (lonas, escoamento, ventiladores/climatização, sinalização, seguro-chuva), responsáveis.
4. **Comunicação:** templates para avisar cliente/público/equipe (liga com Campanhas/Portal) em caso de mudança; política de remarcação (liga com Contratos).
5. **Específicos:** air show/fly-in (teto e visibilidade mínimos, vento cruzado); corrida (calor/UV — protocolo de hidratação); equestre (piso/lama).

**Critérios de aceite:** previsão por data/local do evento; gatilho passa risco para amarelo/vermelho; plano B aciona checklist + comunicado; degrade sem API (manual); política de remarcação referenciada do contrato.
