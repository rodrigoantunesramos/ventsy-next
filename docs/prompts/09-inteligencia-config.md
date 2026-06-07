# 09 — Inteligência & Configuração

Páginas: **Relatórios & BI**, **Metas & OKR**, **Automações & Notificações**, **Configurações (empresa & conta)**, **Multi-unidades / Franquias**, **Auditoria & Logs**.

> Pré-requisito: leia `00-contexto-base.md`. `/painel/relatorios` e `/painel/configuracoes` já existem — estas specs estendem. Configurações é fundação (moeda, fuso, papéis) e deve ser uma das primeiras.

---

## Relatórios & BI · `/painel/relatorios` (estender)

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Relatórios & BI" em docs/prompts/09-inteligencia-config.md. A rota /painel/relatorios já existe — estenda para um BI com indicadores do nicho (ocupação, RevPAS, receita por m²/evento), construtor de relatórios e exportação agendada. Gráficos em SVG. Sem "R$" hardcoded.
```

- **NAV:** grupo Gestão. **Premium:** Pro+. **Objetivo:** central de inteligência que cruza todos os módulos — comercial, financeiro, operações, ocupação, clientes — com indicadores próprios de locação de eventos e relatórios exportáveis/agendáveis.

**Indicadores do nicho (KPIs)**
- **Ocupação:** % de ocupação por espaço/mês, dias ocupados, taxa de conversão de datas procuradas.
- **RevPAS** (Revenue per Available Space-day): receita ÷ (espaços × dias disponíveis).
- **Receita por m²** e **por evento**; **ticket médio** por tipo de evento.
- **Comercial:** conversão lead→proposta→contrato, ciclo de venda, valor em pipeline (puxa CRM/Propostas).
- **Financeiro:** margem por evento/tipo, DRE resumido, inadimplência (puxa Contabilidade).
- **Operacional:** custo de pessoal/A&B por evento, no-show, NPS/avaliação média.

**Seções & funcionalidades**
1. **Dashboards prontos:** Comercial, Financeiro, Operacional, Clientes, Ocupação — cada um com filtros (período, propriedade, tipo de evento).
2. **Construtor de relatório:** escolher dimensão (tempo/propriedade/tipo/cliente/canal) × métrica → tabela + gráfico (SVG); salvar relatório.
3. **Exportação & agendamento:** PDF/Excel; envio automático por e-mail (diário/semanal/mensal — liga com Automações/cron).
4. **Comparativos & metas:** vs. período anterior e vs. meta (liga com Metas).
5. **IA (Pro+):** "explique este resultado" e "o que mudou no mês" em linguagem natural.

**Critérios de aceite:** RevPAS/ocupação/receita por m² corretos; construtor gera e salva; export agendado dispara por cron; filtros consistentes entre dashboards; números batem com os módulos-fonte.

---

## Metas & OKR · `/painel/metas`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Metas & OKR" em docs/prompts/09-inteligencia-config.md, depois implemente /painel/metas (metas por área e período, acompanhamento automático vs. realizado, OKRs). Reutilize metas_financeiras. Sem "R$" hardcoded.
```

- **NAV:** grupo Conta/Inteligência. **Objetivo:** definir metas (receita, ocupação, nº de eventos, NPS, CAC, margem) por período e acompanhar o realizado automaticamente a partir dos módulos. OKRs simples (objetivo + resultados-chave) por trimestre.

**Modelo de dados** — estender/usar `metas_financeiras`; nova `metas`: `id, usuario_id, area ('comercial'|'financeiro'|'operacional'|'marketing'|'pessoas'), metrica, periodo, alvo_num, realizado_num (calculado), responsavel, propriedade_id`. `okrs`: `id, usuario_id, objetivo, trimestre, krs jsonb (kr→alvo→atual→progresso)`.

**Seções & funcionalidades**
1. **Quadro de metas:** por área/período, alvo × realizado (puxa Financeiro/CRM/Relatórios), % de atingimento, projeção de fechamento (run-rate), semáforo.
2. **OKRs:** objetivos do trimestre com KRs e progresso automático onde a métrica existir.
3. **Alertas:** meta em risco (projeção < alvo), meta batida (comemora). Liga com Notificações.
4. **Histórico:** atingimento ao longo do tempo, por responsável/propriedade.

**Critérios de aceite:** realizado calcula automaticamente da fonte certa; projeção/run-rate coerente; OKR mostra progresso; alerta de meta em risco; histórico por período.

---

## Automações & Notificações · `/painel/automacoes`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Automações & Notificações" em docs/prompts/09-inteligencia-config.md, depois implemente /painel/automacoes (gatilho→ação no estilo "se isto, então aquilo", + central de notificações e lembretes). Use cron existente e lib/email. Sem "R$" hardcoded.
```

- **NAV:** grupo Conta/Inteligência. **Objetivo:** reduzir trabalho manual com regras **gatilho → condição → ação** que costuram os módulos, e uma central de notificações/lembretes (no app, e-mail, WhatsApp). É o "tecido conectivo" entre Campanhas, Cobrança, Feedback, Produção, Licenças, etc.

**Modelo de dados**
- `automacoes`: `id, usuario_id, nome, gatilho ('evento_criado'|'X_dias_antes_evento'|'X_dias_apos_evento'|'parcela_vence'|'parcela_atrasa'|'contrato_nao_assinado'|'feedback_negativo'|'aniversario_cliente'|'licenca_a_vencer'|'estoque_minimo'|...), condicao jsonb, acao ('enviar_email'|'enviar_whatsapp'|'criar_tarefa'|'criar_cobranca'|'notificar'|'mover_funil'|...), acao_config jsonb, ativo, ultima_exec`.
- `automacoes_log`: execuções (quando, alvo, sucesso/erro).
- `notificacoes`: `id, usuario_id, tipo, titulo, corpo, link, lida bool, criado_em` (central in-app).

**Seções & funcionalidades**
1. **Biblioteca de receitas prontas** (1 clique): lembrete de parcela, cobrança de atraso, "contrato pendente há 48h", pesquisa pós-evento, parabéns de aniversário, alerta de licença/seguro a vencer, reposição de estoque, briefing pendente 7 dias antes, agradecimento pós-evento.
2. **Construtor:** gatilho → condição (filtros) → ação → canal/agendamento. Preview e teste.
3. **Execução:** cron já existente (`app/api/cron`) processa gatilhos temporais; eventos do sistema disparam em tempo real; log de execução; respeita opt-out e limites do plano.
4. **Central de notificações:** sino no topo (in-app) + preferências por canal/tipo; "minhas pendências do dia" (parcelas, contratos, OS, licenças, escalas).

**Critérios de aceite:** receita pronta ativa em 1 clique e dispara; cron processa gatilhos por data; ação de e-mail/WhatsApp/tarefa/cobrança funciona; log com sucesso/erro; central in-app marca lida; respeita opt-out.

---

## Configurações (empresa & conta) · `/painel/configuracoes` (estender)

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Configurações" em docs/prompts/09-inteligencia-config.md. A rota /painel/configuracoes já existe — estenda para configurações completas de empresa e conta (perfil da empresa, fiscal, equipe & papéis/permissões, preferências, idioma/moeda/fuso, marca, segurança, plano, dados/LGPD). Sem "R$" hardcoded.
```

- **NAV:** grupo Conta (já existe). **Objetivo:** central de configuração de **empresa** (dados, marca, fiscal, espaços, papéis) e **conta** (perfil, segurança, preferências, idioma, plano). É fundação — define moeda/fuso/idioma e papéis que TODAS as páginas respeitam.

**Modelo de dados**
- `empresa_config` (por usuario_id): `razao_social, fantasia, cnpj, ie, endereco, contatos, logo_url, cores_marca jsonb, fuso, moeda, idioma ('pt'|'en'|'es'), config_fiscal jsonb`.
- `usuarios_papeis`: `id, usuario_id (dono/conta), membro_id (→equipe/auth), papel ('admin'|'financeiro'|'comercial'|'operacional'|'rh'|'recepcao'|'leitura'), permissoes jsonb`.
- Reusa `usuarios`, `assinaturas`.

**Seções & funcionalidades (abas)**
1. **Empresa:** identidade (razão social, CNPJ, logo, cores da marca usadas em propostas/contratos/portal), contatos, endereços, espaços/propriedades (atalho).
2. **Fiscal:** regime, CNAE, código de serviço, alíquotas, dados de emitente (alimenta Faturamento/Contabilidade).
3. **Equipe & Permissões:** convidar usuários, atribuir papéis e permissões por módulo (RBAC), 2FA obrigatório por papel. (Multi-usuário sob a mesma conta.)
4. **Preferências:** **idioma (PT/EN/ES)**, moeda, fuso, formato de data, primeira-hora da agenda, numeração de documentos (propostas/contratos/notas), templates padrão.
5. **Conta & Segurança:** perfil do dono, e-mail/senha, 2FA, sessões ativas, logout remoto.
6. **Plano & Cobrança:** plano atual (lê `assinaturas`), uso vs. limites, upgrade (liga `/painel/planos`), faturas da assinatura.
7. **Dados & LGPD:** exportar meus dados, política de retenção, encerrar conta (liga `/painel/juridico`).

**Critérios de aceite:** idioma/moeda/fuso aplicam em todo o painel via `lib/format`; papéis/permissões realmente restringem páginas e ações (RBAC no client + checagem em rotas de API); marca aparece em proposta/contrato/portal; numeração configurável respeitada; 2FA funcional.

---

## Multi-unidades / Franquias · `/painel/unidades`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Multi-unidades / Franquias" em docs/prompts/09-inteligencia-config.md, depois implemente /painel/unidades (gestão consolidada de várias propriedades/unidades, comparativo e troca de contexto). Sem "R$" hardcoded.
```

- **NAV:** grupo Conta/Inteligência. **Premium:** Ultra. **Objetivo:** para quem opera **várias unidades** (rede de espaços, franquias, parque com vários pavilhões geridos como negócios): visão consolidada, comparativo entre unidades, e troca de contexto (ver/filtrar por unidade). Cada unidade é uma `propriedade` (ou grupo de espaços); o dono pode ter muitas.

**Modelo de dados** — usar `propriedades` como unidade; nova `unidades_grupos` (para franquias/redes) e `unidades_acesso` (qual membro acessa qual unidade — liga com Permissões). Consolidação por agregação das tabelas já escopadas por `propriedade_id`.

**Seções & funcionalidades**
1. **Visão consolidada:** receita, ocupação, eventos, margem, NPS — somados e **por unidade** (ranking, comparativo lado a lado).
2. **Troca de contexto:** seletor global "todas as unidades / unidade X" que filtra o painel inteiro (ou um seletor por página).
3. **Benchmark:** comparar unidades (ocupação, ticket, conversão, custo) — melhores práticas.
4. **Franquia (opcional):** royalties/taxas por unidade, repasses, padronização de templates (preços, contratos, cardápios) distribuídos às unidades.

**Critérios de aceite:** consolidado soma corretamente as unidades; seletor de unidade filtra o painel; ranking/benchmark coerente; permissões por unidade respeitadas; degrade gracioso para quem tem 1 unidade.

---

## Auditoria & Logs · `/painel/auditoria`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Auditoria & Logs" em docs/prompts/09-inteligencia-config.md, depois implemente /painel/auditoria (trilha de quem fez o quê: criação/edição/exclusão em entidades sensíveis, logins, exportações). Sem "R$" hardcoded.
```

- **NAV:** grupo Conta/Inteligência. **Premium:** Pro+. **Objetivo:** trilha de auditoria — registrar e consultar quem fez o quê e quando, especialmente em entidades sensíveis (financeiro, contratos, preços, permissões, exclusões, exportações, logins). Essencial com multi-usuário e para confiança/compliance.

**Modelo de dados**
- `auditoria_log`: `id, usuario_id (conta), ator_id (membro), acao ('criar'|'editar'|'excluir'|'login'|'exportar'|'permissao'|'pagamento'|...), entidade, entidade_id, antes jsonb, depois jsonb, ip, user_agent, criado_em`.
- Preencher via helper central (`lib/audit.ts`) chamado nas rotas de API sensíveis; particionar/expurgar por retenção.

**Seções & funcionalidades**
1. **Linha do tempo:** eventos de auditoria com filtro por ator/ação/entidade/período; diff "antes→depois" em edições sensíveis.
2. **Sensíveis em destaque:** exclusões, alterações de preço/financeiro, mudanças de permissão, exportações de dados, logins suspeitos.
3. **Segurança:** logins (sucesso/falha), dispositivos/sessões, alertas de acesso incomum.
4. **Exportar:** trilha por período (para auditoria externa); retenção configurável (liga com LGPD/Configurações).

**Critérios de aceite:** ações sensíveis nas rotas de API gravam log via `lib/audit.ts`; diff antes/depois visível; filtros funcionam; exportação por período; retenção respeitada; não logar segredos/dados sensíveis em claro.
```

---

## Encerramento do kit

Estas 9 specs + `00-contexto-base.md` + `README.md` cobrem **todas as páginas pedidas** e as que fazem sentido para locação de espaços de eventos em qualquer escala. Para construir: siga a ordem do `README.md`, uma página por sessão, sempre colando a **linha de kickoff** da página. Atualize o status (⬜/🟡/✅) no README conforme avança.
