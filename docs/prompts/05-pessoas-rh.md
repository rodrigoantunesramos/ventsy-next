# 05 — Pessoas (RH)

Páginas: **RH completo**, **Ponto & Escala**.

> Pré-requisito: leia `00-contexto-base.md`. **Já existe** `/painel/equipe` com motor de folha/encargos BR (CLT/Horista/MEI/Estágio) e a tabela `equipe`. O RH **estende** isso para o ciclo completo — não recrie a folha do zero, reutilize a engine de `equipe`.

---

## RH completo · `/painel/rh`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "RH completo" em docs/prompts/05-pessoas-rh.md. Reutilize a tabela `equipe` e o motor de folha já existente em /painel/equipe; NÃO duplique a folha. Implemente /painel/rh como hub com sub-rotas (funcionários, recrutamento, admissão, férias, ponto, documentos, desligamento). Sem "R$" hardcoded.
```

- **NAV:** novo grupo "Pessoas". **Premium:** Pro+. **Objetivo:** RH de ponta a ponta para operação de eventos, que mistura **CLT fixo + freelancers/diaristas de evento** (garçom, segurança, recepcionista, montador, manobrista, brigadista). Cobre: quadro de funcionários, recrutamento & seleção, admissão (onboarding), documentação, folha/benefícios (reusa `equipe`), férias/afastamentos, ponto/escala (página própria), avaliação/treinamento e desligamento.
- **Arquitetura:** `/painel/rh` é um **hub** com abas/sub-rotas. Migre o conteúdo de `equipe` para cá (ou mantenha `equipe` como aba "Funcionários/Folha" e adicione o resto). Combine numa sessão de planejamento antes de codar.

**Modelo de dados** (estende `equipe`)
- `equipe` (existe): pessoa + contrato + salário + folha. Adicionar: `cpf, rg, nascimento, foto_url, banco jsonb, dependentes int, jornada, centro_custo_id, gestor_id, desligado_em, motivo_desligamento`.
- `rh_vagas`: `id, usuario_id, titulo, departamento, tipo_contrato, salario_faixa, descricao, requisitos, status ('aberta'|'pausada'|'fechada'), vagas int, criado_em`.
- `rh_candidatos`: `id, vaga_id, nome, contato, curriculo_url, etapa ('triagem'|'entrevista'|'teste'|'proposta'|'contratado'|'reprovado'), nota, obs`.
- `rh_documentos`: `id, equipe_id, tipo ('rg'|'cpf'|'ctps'|'aso'|'contrato'|'comprovante'|'certificacao'|...), arquivo_url, validade, status`.
- `rh_ausencias`: `id, equipe_id, tipo ('ferias'|'atestado'|'licenca'|'falta'|'folga'|'banco_horas'), inicio, fim, dias, status ('solicitada'|'aprovada'|'reprovada'|'gozada'), saldo, obs`.
- `rh_eventos_funcionario`: timeline (admissão, promoção, advertência, treinamento, desligamento).

**Seções & funcionalidades (abas)**
1. **Visão geral:** headcount, por departamento/contrato, custo de folha do mês, turnover, admissões/desligamentos no mês, aniversariantes, docs/ASO vencendo, férias vencidas (passivo!).
2. **Funcionários:** quadro com ficha completa (dados, contrato, banco, dependentes, gestor, centro de custo, documentos, histórico, ausências). Reaproveita a folha de `equipe`.
3. **Recrutamento & Seleção:** vagas + **Kanban de candidatos** (triagem→entrevista→teste→proposta→contratado), banco de talentos, link público de vaga (`(public)/vagas/[slug]`), upload de currículo. IA: triagem/resumo de currículo.
4. **Admissão / Onboarding:** checklist de admissão (documentos, exames ASO, contrato, uniforme, treinamentos), ao concluir cria o funcionário em `equipe`. Geração de contrato de trabalho/termo (liga com Contratos).
5. **Documentação:** repositório por funcionário com validade (ASO, certificações — brigada, NR, vigilante), alertas de vencimento.
6. **Folha & Benefícios:** **reusa engine de `equipe`** — proventos/descontos, encargos (INSS/FGTS), VT/VR/VA, 13º, provisões; holerite PDF; export para contador.
7. **Férias & Ausências:** solicitação→aprovação, saldo e **vencimento de férias** (alerta de passivo trabalhista), atestados, banco de horas (integra Ponto).
8. **Avaliação & Treinamento:** avaliações de desempenho simples, registro de treinamentos obrigatórios (NRs, brigada, manipulação de alimentos), matriz de competências.
9. **Desligamento:** checklist (aviso, exame demissional, devolução de ativos/uniforme/EPI, acerto), cálculo de rescisão (reusa engine), entrevista de desligamento.

**Critérios de aceite:** admissão concluída cria funcionário em `equipe` e dispara folha; férias mostram saldo/vencimento corretos; docs/ASO vencendo alertam; Kanban de candidatos persiste; rescisão calcula; custo de folha bate com Contabilidade (centro de custo).

> **Sessão sugerida em 3 partes:** (1) Hub + Funcionários (migra equipe) + Documentação; (2) Recrutamento + Admissão + Desligamento; (3) Férias/Ausências + Avaliação/Treinamento.

---

## Ponto & Escala · `/painel/ponto`

**Kickoff:**
```
Leia docs/prompts/00-contexto-base.md e a seção "Ponto & Escala" em docs/prompts/05-pessoas-rh.md, depois implemente /painel/ponto (escala de turnos por evento, ponto/registro de horas de fixos e freelancers, banco de horas, custo de mão de obra por evento). Sem "R$" hardcoded.
```

- **NAV:** grupo Pessoas. **Objetivo:** escalar equipe e freelancers para cada evento, registrar ponto (entrada/saída), calcular horas/extras/banco de horas, e apurar o **custo de mão de obra por evento** (entra no custo direto do evento). Eventos têm picos: um casamento usa 20 freelancers numa noite; uma feira de 3 dias, centenas de turnos.

**Modelo de dados**
- `escalas`: `id, usuario_id, evento_id, reserva_id, propriedade_id, data, turno, funcao ('garcom'|'seguranca'|'recepcao'|'montador'|'manobrista'|'brigadista'|'limpeza'|'coordenacao'|...), necessario int, status`.
- `escalas_alocacao`: `id, escala_id, pessoa_id (equipe ou freelancer), inicio_previsto, fim_previsto, valor_diaria_num, status ('convocado'|'confirmado'|'presente'|'falta'|'cancelado')`.
- `freelancers`: `id, usuario_id, nome, funcao, contato, valor_diaria_num, avaliacao, doc, chave_pix, ativo` (banco de freelas reutilizável).
- `ponto_registros`: `id, alocacao_id/equipe_id, evento_id, entrada, saida, horas, he_num, atraso_min, origem ('app'|'qr'|'manual'|'biometria'), local, criado_em`.

**Seções & funcionalidades**
1. **Planejar escala do evento:** definir funções × quantidade × turnos (template por tipo de evento: "casamento 200 pax = 8 garçons + 2 seguranças + 1 coord"), arrastar pessoas/freelancers para vagas, ver custo previsto.
2. **Convocação:** convidar freelancers (WhatsApp/e-mail/portal), confirmar presença, lista de espera; banco de freelancers por função/avaliação/disponibilidade.
3. **Ponto:** registro por QR/link no dia (check-in/out por turno), ou manual; atrasos/faltas; cobre fixos e freelancers.
4. **Apuração:** horas, horas extras, adicional noturno, banco de horas (integra RH/Ausências); **custo de mão de obra por evento** → alimenta custo direto na Contabilidade e a margem do evento.
5. **Pagamento de freelas:** fechar diárias do evento → gera contas a pagar (Financeiro) e/ou comissão.
6. **Painel:** cobertura de escalas (vagas preenchidas), custo de pessoal por evento/mês, no-show de freelancers, ranking.

**Critérios de aceite:** escala impede sub/superalocação por função; convocação confirma presença; ponto calcula HE/atraso; custo de pessoal aparece no custo do evento; fechar diárias gera conta a pagar; templates por tipo de evento agilizam.
