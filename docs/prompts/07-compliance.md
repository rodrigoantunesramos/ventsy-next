# 07 — Conformidade & Risco

Páginas: **Licenças, Alvarás & Compliance**, **Seguros**, **Saúde, Segurança & Emergência (SST)**, **Jurídico & LGPD**.

> Pré-requisito: leia `00-contexto-base.md`. Evento sem licença/seguro é risco existencial. Pensar grande: cada tipo de evento e porte tem exigências próprias (bombeiros, ECAD, ANVISA/vigilância sanitária, ambiental, polícia/segurança pública, ANAC para aéreo, FEI/CBH para equestre, CBA para automobilismo).

---

## Licenças, Alvarás & Compliance · `/painel/licencas`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Licenças, Alvarás & Compliance" em docs/prompts/07-compliance.md, depois implemente /painel/licencas (alvarás do espaço + licenças por evento, com vencimento, órgão, documentos e checklist por tipo de evento). Sem "R$" hardcoded.
```

- **NAV:** novo grupo "Conformidade". **Objetivo:** controlar tudo que mantém a operação legal — alvarás permanentes do espaço (funcionamento, bombeiros/AVCB, sanitário, ambiental) e licenças por evento (autorização de evento, som/ruído, ECAD, vigilância sanitária para A&B, polícia/segurança, licença ambiental temporária, fechamento de via para corrida, NOTAM/ANAC para aéreo). Vencimentos, órgãos, custos e documentos num só lugar.

**Modelo de dados**
- `licencas`: `id, usuario_id, propriedade_id, escopo ('permanente'|'evento'), evento_id, tipo ('funcionamento'|'avcb_bombeiros'|'sanitaria'|'ambiental'|'ruido_som'|'ecad'|'evento_publico'|'policia'|'via_publica'|'anac'|'outro'), orgao, numero, emissao, validade, custo_num, status ('vigente'|'a_vencer'|'vencida'|'em_processo'|'nao_aplicavel'), responsavel, documento_url, obs`.
- `compliance_checklists`: `id, usuario_id, tipo_evento, itens jsonb (licença/exigência por porte)` — biblioteca por tipo/porte de evento.

**Seções & funcionalidades**
1. **Painel de conformidade:** semáforo geral, licenças a vencer (30/60/90d), vencidas (bloqueante), custo anual de licenças, por propriedade.
2. **Alvarás permanentes:** AVCB, funcionamento, sanitário, ambiental — com renovação programada (alerta) e documentos.
3. **Licenças por evento:** ao planejar um evento, aplica o **checklist por tipo/porte** (ex.: "show >2000 pessoas" exige laudo, ambulância, brigada, ECAD, alvará de evento, segurança) e acompanha cada item (responsável, prazo, protocolo, documento). Bloqueia "evento pronto" se item obrigatório pendente.
4. **Biblioteca de exigências:** templates por tipo de evento e faixa de público (configurável, pois varia por município).
5. **Documentos & protocolos:** anexos, número de protocolo, contato do órgão.

**Critérios de aceite:** vencidas/a vencer alertam com antecedência; checklist por tipo/porte gera exigências do evento; item obrigatório pendente bloqueia prontidão do evento (liga com Produção); custo de licenças entra no contábil.

---

## Seguros · `/painel/seguros`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Seguros" em docs/prompts/07-compliance.md, depois implemente /painel/seguros (apólices do espaço e por evento, coberturas, vigência, sinistros, custo). Sem "R$" hardcoded.
```

- **NAV:** grupo Conformidade. **Objetivo:** gerir apólices — patrimoniais do espaço (incêndio, RC geral), por evento (responsabilidade civil de evento, cancelamento/seguro-chuva, acidentes pessoais para corrida/equestre/automobilismo), frota e equipamentos. Coberturas, vigências, custo e sinistros.

**Modelo de dados**
- `seguros`: `id, usuario_id, escopo ('patrimonial'|'evento'|'frota'|'equipamento'|'rc'|'acidentes'), propriedade_id, evento_id, seguradora, corretor, apolice, coberturas jsonb (item→limite), franquia_num, premio_num, vigencia_inicio, vigencia_fim, status, documento_url`.
- `sinistros`: `id, seguro_id, data, descricao, valor_estimado_num, valor_indenizado_num, status, anexos`.

**Seções & funcionalidades**
1. **Carteira de apólices:** vigentes, a vencer, coberturas e limites, prêmio total/ano, por escopo. Alertas de renovação.
2. **Seguro por evento:** vincular apólice de RC/acidentes a um evento (obrigatório para certos tipos — automobilismo, equestre, corrida); checar se exigência de Licenças está coberta.
3. **Sinistros:** abrir, acompanhar, anexar documentos, valor indenizado, lições.
4. **Custos:** prêmio por evento (entra no custo do evento), índice de sinistralidade.

**Critérios de aceite:** apólice a vencer alerta; seguro de evento atende a exigência de Licenças; sinistro com rastro; prêmio rateado ao custo do evento.

---

## Saúde, Segurança & Emergência (SST) · `/painel/sst`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Saúde, Segurança & Emergência" em docs/prompts/07-compliance.md, depois implemente /painel/sst (plano de emergência, brigada, APH/ambulância, EPIs, NRs, simulados, ocorrências). Sem "R$" hardcoded.
```

- **NAV:** grupo Conformidade. **Objetivo:** segurança de pessoas — plano de emergência e evacuação por espaço/evento, brigada de incêndio, atendimento pré-hospitalar (posto médico/ambulância), EPIs e treinamentos (NRs), simulados e registro de ocorrências/acidentes. Obrigatório e vital em grandes públicos (show, feira, corrida, automobilismo).

**Modelo de dados**
- `sst_planos`: `id, usuario_id, propriedade_id, evento_id, tipo ('emergencia'|'evacuacao'|'aph'|'incendio'), conteudo jsonb (rotas, pontos de encontro, recursos), responsavel, validade`.
- `sst_recursos_evento`: `id, evento_id, tipo ('ambulancia'|'posto_medico'|'brigadista'|'bombeiro_civil'|'extintor'|'desfibrilador'), quantidade, fornecedor_id, status`.
- `sst_ocorrencias`: `id, evento_id, tipo, gravidade, descricao, pessoa, atendimento, data, anexos`.
- Liga com `equipe`/freelancers (brigadistas), `rh_documentos` (certificações NR/brigada), `manutencao` (extintores/AVCB).

**Seções & funcionalidades**
1. **Planos de emergência** por espaço/evento: rotas de fuga, pontos de encontro, recursos, mapa (liga com Layouts), contatos (SAMU/bombeiros).
2. **Dimensionamento por evento:** público × exigências (ambulância, posto médico, brigadistas, extintores, desfibrilador) — checklist que vira recursos a contratar (Logística/Compras) e a alocar (Escala).
3. **EPIs & NRs:** controle de EPIs, treinamentos obrigatórios e validade (liga com RH).
4. **Simulados & inspeções:** registro, periodicidade.
5. **Ocorrências:** registro de acidentes/incidentes/atendimentos, gravidade, CAT quando aplicável, indicadores.

**Critérios de aceite:** dimensionamento gera recursos exigidos por público; recursos faltantes bloqueiam prontidão; certificações de brigada vêm do RH; ocorrências com indicadores; plano por evento referencia o layout.

---

## Jurídico & LGPD · `/painel/juridico`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Jurídico & LGPD" em docs/prompts/07-compliance.md, depois implemente /painel/juridico (repositório de contratos/processos, prazos, LGPD: consentimentos, solicitações de titular, retenção). Sem "R$" hardcoded.
```

- **NAV:** grupo Conformidade. **Objetivo:** central jurídica e de privacidade — repositório de contratos vigentes (clientes, fornecedores, trabalho, parceria), processos/notificações, prazos jurídicos, e **conformidade LGPD** (registro de consentimentos, atendimento a solicitações de titulares, política de retenção, base legal). Importante porque a plataforma coleta muitos dados pessoais (convidados, clientes, ingressos).

**Modelo de dados**
- `juridico_contratos` (visão consolidada de `contratos` + fornecedores/trabalho/parceria), `juridico_processos`: `id, usuario_id, tipo, parte, numero, status, prazo, valor_envolvido_num, advogado, anexos`.
- `lgpd_consentimentos`: `id, usuario_id, titular_tipo ('cliente'|'convidado'|'funcionario'|'lead'), titular_id, finalidade, base_legal, canal, concedido_em, revogado_em`.
- `lgpd_solicitacoes`: `id, usuario_id, titular, tipo ('acesso'|'correcao'|'exclusao'|'portabilidade'), status, prazo, resposta, criado_em`.

**Seções & funcionalidades**
1. **Contratos & prazos:** painel de vencimentos/renovações de todos os contratos (clientes, fornecedores, trabalho), alertas.
2. **Processos & notificações:** acompanhamento, prazos, custos, advogado responsável.
3. **LGPD — Consentimentos:** registro de quando/como o titular consentiu (formulários, ingressos, portal), base legal e finalidade.
4. **LGPD — Direitos do titular:** fila de solicitações (acesso/correção/exclusão/portabilidade) com prazo legal e trilha de atendimento; exportar/anonimizar dados de um titular.
5. **Políticas:** retenção e descarte por tipo de dado; termos/política de privacidade versionados (liga com Configurações e páginas públicas `/termos`, `/privacidade`).

**Critérios de aceite:** prazos jurídicos alertam; solicitação de titular com prazo e trilha; exclusão/anonimização efetiva por titular; consentimentos registrados na origem (portal/ingresso/lead); políticas versionadas.
