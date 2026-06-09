# Ventsy — Kit de Prompts Página-a-Página

Catálogo completo de páginas do painel do proprietário (`/painel/*`), pensado como um **ERP/CRM vertical para locação de espaços de eventos** — de buffet de bairro a autódromo, haras, aeroclube, parque de exposições, arena, igreja e centro de convenções.

Cada página tem uma **spec rica** num arquivo de módulo e uma **linha de kickoff** pronta para colar numa sessão do Claude Code. O Claude lê a spec do arquivo, então o prompt que você cola é curto.

---

## Como usar (fluxo por sessão)

1. Abra uma sessão nova do Claude Code na raiz do projeto.
2. Copie a **linha de kickoff** da página que quer construir (está no topo de cada spec, e listada no roadmap abaixo).
3. Cole. O Claude vai ler `docs/prompts/00-contexto-base.md` (stack, design system, convenções) + a spec da página + os arquivos de exemplo citados, e então implementar.
4. Ao terminar, peça verificação no preview e marque a página como ✅ neste README.

> **Regra de ouro:** uma página por sessão. Páginas grandes (RH, Contabilidade, Operações) podem virar 2–3 sessões — a própria spec sugere o corte.

A linha de kickoff tem sempre este formato:

```
Leia docs/prompts/00-contexto-base.md e a seção "<Página>" em docs/prompts/<arquivo>.md, depois implemente a página seguindo a spec à risca. Mantenha o nível da página financeiro já existente. Não invente "R$" no código — use lib/format.
```

---

## Princípios do produto (pense GRANDE)

Não trate "evento" como festinha. O mesmo sistema precisa servir:

- **Sociais:** casamento, aniversário, formatura, bodas, debutante, bar/bat mitzvah.
- **Corporativos:** convenção, lançamento, treinamento, premiação, confraternização.
- **Religiosos:** festa de igreja, retiro, congresso, casamento religioso, quermesse.
- **Equestres:** prova de laço, vaquejada, hípica, leilão de cavalos, cavalgada, rodeio.
- **Automobilísticos:** track day, exposição de carros, encontro de clubes, arrancada, kart.
- **Aéreos:** air show, fly-in, encontro de aeromodelismo, balonismo.
- **Esportivos:** corrida de rua, trail, ciclismo, crossfit, luta, e-sports.
- **Feiras & Expos:** estande/expositor, patrocínio, congresso, feira agro, food festival.
- **Shows & cultura:** festival, show, teatro, stand-up, cinema ao ar livre.

Implicações que aparecem nas specs: **multi-espaço** (galpão + arena + camarote + estacionamento + área externa), **outdoor com plano B/clima**, **bilheteria/credenciamento** (não só "reserva fechada"), **expositores/patrocínio**, **controle de acesso e capacidade**, **licenças** (bombeiros, ECAD, ANVISA, ambiental, álcool), **locação de equipamentos** (palco, tenda, arquibancada, som), **logística de montagem**.

---

## Catálogo completo & ordem de construção

Legenda: ⬜ a fazer · 🟡 existe (estender) · ✅ pronto

### Fase 0 — Fundação (entidades referenciadas por tudo)
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Configurações da empresa & conta | `/painel/configuracoes` | `09-inteligencia-config.md` | ✅ |
| Clientes (CRM 360º) | `/painel/clientes` | `01-relacionamento.md` | ✅ |
| Fornecedores | `/painel/fornecedores` | `04-suprimentos.md` | ✅ |
| Precificação & tabela de preços | `/painel/precificacao` | `02-comercial.md` | ✅ |
| Reservas & Calendário multi-espaço | `/painel/reservas` · `/painel/calendario` | `02-comercial.md` | ✅ |

### Fase 1 — Comercial (gera receita → alimenta o financeiro)
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Orçamentos & Propostas | `/painel/propostas` | `02-comercial.md` | ✅ |
| Contratos & Assinatura digital | `/painel/contratos` | `02-comercial.md` | ✅ |

### Fase 2 — Financeiro & Contábil
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Financeiro (cockpit CFO) | `/painel/financeiro` | — | ✅ existe |
| Contabilidade completa | `/painel/contabilidade` | `03-financeiro.md` | ✅ |
| Faturamento & Notas fiscais | `/painel/faturamento` | `03-financeiro.md` | ✅ |
| Contas a pagar/receber | `/painel/recebiveis` | `03-financeiro.md` | 🟡 existe |
| Comissões | `/painel/comissoes` | `03-financeiro.md` | ✅ |

### Fase 3 — Suprimentos & Patrimônio
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Compras (requisição→cotação→pedido→entrega) | `/painel/compras` | `04-suprimentos.md` | ✅ |
| Estoque / Almoxarifado | `/painel/estoque` | `04-suprimentos.md` | ✅ |
| Ativos & Bens (patrimônio) | `/painel/ativos` | `04-suprimentos.md` | ✅ |
| Equipamentos & Locação de itens | `/painel/equipamentos` | `04-suprimentos.md` | ✅ |
| Manutenção & Ordens de Serviço | `/painel/manutencao` | `04-suprimentos.md` | ✅ |

### Fase 4 — Pessoas (RH)
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| RH completo (admissão→demissão, folha, férias, docs, recrutamento) | `/painel/rh` | `05-pessoas-rh.md` | ✅ |
| Ponto & Escala (turnos/freelancers de evento) | `/painel/ponto` | `05-pessoas-rh.md` | ✅ |

### Fase 5 — Operações de Evento (o diferencial do nicho)
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Produção & Run-of-show (Kanban do evento) | `/painel/producao` | `06-operacoes-eventos.md` | ✅ |
| Logística: montagem & desmontagem | `/painel/logistica` | `06-operacoes-eventos.md` | ✅ |
| Segurança, Controle de acesso & Credenciamento | `/painel/acesso` | `06-operacoes-eventos.md` | ✅ |
| Estacionamento & Mobilidade | `/painel/estacionamento` | `06-operacoes-eventos.md` | ✅ |
| Ingressos & Bilheteria | `/painel/bilheteria` | `06-operacoes-eventos.md` | ✅ |
| Expositores & Patrocínios | `/painel/expositores` | `06-operacoes-eventos.md` | ✅ |
| Catering, Buffet & Bar | `/painel/catering` | `06-operacoes-eventos.md` | ✅ |
| Layouts, Plantas & Capacidade | `/painel/layouts` | `06-operacoes-eventos.md` | ✅ |
| Clima & Plano B (outdoor) | `/painel/plano-b` | `06-operacoes-eventos.md` | ✅ |

### Fase 6 — Relacionamento, Comunidade & Marketing
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Avaliações públicas (dono responde) | `/painel/avaliacoes` | `01-relacionamento.md` | ✅ |
| Feedbacks privados (cliente↔dono) | `/painel/feedbacks` | `01-relacionamento.md` | ✅ |
| Campanhas (envio em massa) | `/painel/campanhas` | `01-relacionamento.md` | ✅ |
| Marketing (cockpit) | `/painel/marketing` | `01-relacionamento.md` | ✅ |
| Listas Oficiais (comunidade) | `/painel/listas` | `01-relacionamento.md` | ✅ |
| Portal do Cliente (área do contratante) | `/painel/portal` (+ rota pública) | `01-relacionamento.md` | ⬜ |
| Pesquisas & NPS pós-evento | `/painel/pesquisas` | `01-relacionamento.md` | ✅ |

### Fase 7 — Conformidade & Risco
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Licenças, Alvarás & Compliance | `/painel/licencas` | `07-compliance.md` | ⬜ |
| Seguros | `/painel/seguros` | `07-compliance.md` | ⬜ |
| Saúde, Segurança & Emergência (SST) | `/painel/sst` | `07-compliance.md` | ⬜ |
| Jurídico & LGPD | `/painel/juridico` | `07-compliance.md` | ⬜ |

### Fase 8 — Terceiros, Integrações & Inteligência
| Página | Rota | Arquivo | Status |
|---|---|---|---|
| Terceiros (custo × retorno) | `/painel/terceiros` | `08-terceiros-integracoes.md` | ⬜ |
| Integrações (apps, APIs, webhooks) | `/painel/integracoes` | `08-terceiros-integracoes.md` | 🟡 API existe |
| Relatórios & BI | `/painel/relatorios` | `09-inteligencia-config.md` | 🟡 existe |
| Metas & OKR | `/painel/metas` | `09-inteligencia-config.md` | ⬜ |
| Automações & Notificações | `/painel/automacoes` | `09-inteligencia-config.md` | ⬜ |
| Multi-unidades / Franquias | `/painel/unidades` | `09-inteligencia-config.md` | ⬜ |
| Auditoria & Logs | `/painel/auditoria` | `09-inteligencia-config.md` | ⬜ |

---

## Mapa de arquivos de spec

- `00-contexto-base.md` — **leia sempre.** Stack, design system, convenções de dados/RLS/API/i18n, checklist de qualidade.
- `01-relacionamento.md` — Clientes, Avaliações, Feedbacks, Campanhas, Marketing, Listas, Portal, NPS.
- `02-comercial.md` — Reservas/Calendário, Precificação, Propostas, Contratos.
- `03-financeiro.md` — Contabilidade, Faturamento/Fiscal, Contas a pagar/receber, Comissões.
- `04-suprimentos.md` — Fornecedores, Compras, Estoque, Ativos, Equipamentos, Manutenção.
- `05-pessoas-rh.md` — RH completo, Ponto & Escala.
- `06-operacoes-eventos.md` — Produção, Logística, Acesso, Estacionamento, Bilheteria, Expositores, Catering, Layouts, Plano B.
- `07-compliance.md` — Licenças, Seguros, SST, Jurídico/LGPD.
- `08-terceiros-integracoes.md` — Terceiros (custo×retorno), Integrações.
- `09-inteligencia-config.md` — Relatórios/BI, Metas, Automações, Configurações, Multi-unidades, Auditoria.

---

## Dependências (o que construir antes)

```
Configurações ─┬─> tudo (moeda, fuso, unidades, papéis)
Clientes ──────┼─> Propostas, Contratos, Campanhas, Avaliações, Bilheteria, NPS
Precificação ──┴─> Propostas ─> Contratos ─> Financeiro/Faturamento
Reservas ──────────> Produção ─> Logística/Acesso/Estacionamento/Catering
Fornecedores ──────> Compras ─> Estoque ─> Ativos/Equipamentos/Manutenção
Equipe/RH ─────────> Ponto & Escala ─> Operações de evento (alocação de crew)
```

Construa de cima para baixo. Cada spec lista suas dependências no topo e degrada com elegância se a tabela-fonte ainda não existir (mostra empty-state com CTA, nunca quebra).
