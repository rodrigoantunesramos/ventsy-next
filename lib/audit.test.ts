import { describe, it, expect } from 'vitest'
import {
  type AuditLogLike,
  acaoLabel, acaoChip, entidadeLabel, isSensivel,
  redigirSegredos, calcularDiff, temDiff,
  diaDe, addDiasYMD,
  filtrarLogs, resumoAuditoria, atividadePorDia,
  loginsSuspeitos, resumirUserAgent, logsParaCSV, isMissingTable,
  ACOES_SEGURANCA,
} from './audit'

const HOJE = '2026-06-09'

// Fábrica enxuta de log (só o que o motor lê).
function log(p: Partial<AuditLogLike> = {}): AuditLogLike {
  return {
    acao: p.acao ?? 'editar',
    entidade: p.entidade ?? 'lancamento',
    entidade_id: p.entidade_id ?? '1',
    ator_id: p.ator_id ?? 'u1',
    ator_nome: p.ator_nome ?? 'Ana',
    ator_email: p.ator_email ?? 'ana@x.com',
    descricao: p.descricao ?? null,
    sensivel: p.sensivel ?? false,
    sucesso: p.sucesso ?? true,
    ip: p.ip ?? null,
    user_agent: p.user_agent ?? null,
    criado_em: p.criado_em ?? `${HOJE}T10:00:00Z`,
    antes: p.antes ?? null,
    depois: p.depois ?? null,
    meta: p.meta ?? null,
  }
}

// ── Catálogos ─────────────────────────────────────────────────────────────────
describe('catálogos', () => {
  it('acaoLabel/acaoChip resolvem conhecidas e caem no raw', () => {
    expect(acaoLabel('excluir')).toBe('Exclusão')
    expect(acaoLabel('login_falha')).toBe('Login falho')
    expect(acaoLabel('inexistente')).toBe('inexistente')
    expect(acaoLabel(null)).toBe('Outro')
    expect(acaoChip('criar')).toContain('emerald')
  })
  it('entidadeLabel resolve conhecidas e formata o raw', () => {
    expect(entidadeLabel('contrato')).toBe('Contrato')
    expect(entidadeLabel('dados_pessoais')).toBe('Dados pessoais (LGPD)')
    expect(entidadeLabel('coisa_estranha')).toBe('coisa estranha')
    expect(entidadeLabel(null)).toBe('—')
  })
  it('ACOES_SEGURANCA contém os eventos de autenticação', () => {
    expect(ACOES_SEGURANCA).toEqual(expect.arrayContaining(['login', 'login_falha', 'logout']))
  })
})

// ── Sensibilidade ─────────────────────────────────────────────────────────────
describe('isSensivel', () => {
  it('marca ação sensível', () => {
    expect(isSensivel('excluir')).toBe(true)
    expect(isSensivel('exportar')).toBe(true)
    expect(isSensivel('pagamento')).toBe(true)
    expect(isSensivel('permissao')).toBe(true)
    expect(isSensivel('login_falha')).toBe(true)
  })
  it('marca entidade sensível (catálogo e regex de fallback)', () => {
    expect(isSensivel('editar', 'contrato')).toBe(true)
    expect(isSensivel('editar', 'precificacao')).toBe(true)   // regex
    expect(isSensivel('editar', 'lancamento_caixa')).toBe(true) // regex
    expect(isSensivel('editar', 'foto')).toBe(false)
  })
  it('ação comum em entidade neutra não é sensível', () => {
    expect(isSensivel('editar', 'documento')).toBe(false)
    expect(isSensivel('login')).toBe(false)
  })
})

// ── Redação de segredos ───────────────────────────────────────────────────────
describe('redigirSegredos', () => {
  it('mascara campos cujo nome indica segredo', () => {
    const out = redigirSegredos({ email: 'a@x.com', senha: '123', api_key: 'sk-abc', valor: 100 }) as Record<string, unknown>
    expect(out.email).toBe('a@x.com')
    expect(out.senha).toBe('••••••')
    expect(out.api_key).toBe('••••••')
    expect(out.valor).toBe(100)
  })
  it('é recursivo e cobre aninhados/arrays', () => {
    const out = redigirSegredos({ cfg: { client_secret: 'z', nome: 'ok' }, lista: [{ token: 't' }] }) as Record<string, any>
    expect(out.cfg.client_secret).toBe('••••••')
    expect(out.cfg.nome).toBe('ok')
    expect(out.lista[0].token).toBe('••••••')
  })
  it('trunca strings gigantes e lida com null', () => {
    const big = 'x'.repeat(5000)
    expect(String(redigirSegredos(big)).length).toBeLessThan(2100)
    expect(redigirSegredos(null)).toBeNull()
  })
})

// ── Diff ──────────────────────────────────────────────────────────────────────
describe('calcularDiff', () => {
  it('lista só os campos alterados, ignorando técnicos', () => {
    const d = calcularDiff(
      { valor: 100, status: 'pendente', atualizado_em: 'a' },
      { valor: 250, status: 'pendente', atualizado_em: 'b' },
    )
    expect(d).toEqual([{ campo: 'valor', de: '100', para: '250' }])
  })
  it('detecta criação (antes vazio) e remoção de valor', () => {
    expect(calcularDiff(null, { nome: 'X' })).toEqual([{ campo: 'nome', de: '—', para: 'X' }])
    expect(calcularDiff({ nome: 'X' }, { nome: null })).toEqual([{ campo: 'nome', de: 'X', para: '—' }])
  })
  it('serializa objetos/arrays para comparar', () => {
    const d = calcularDiff({ tags: ['a'] }, { tags: ['a', 'b'] })
    expect(d).toEqual([{ campo: 'tags', de: '["a"]', para: '["a","b"]' }])
  })
  it('temDiff reflete a existência de mudanças', () => {
    expect(temDiff({ antes: { a: 1 }, depois: { a: 2 } })).toBe(true)
    expect(temDiff({ antes: { a: 1 }, depois: { a: 1 } })).toBe(false)
    expect(temDiff({ antes: null, depois: null })).toBe(false)
  })
})

// ── Datas ─────────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('diaDe extrai a parte YYYY-MM-DD', () => {
    expect(diaDe('2026-06-09T23:10:00Z')).toBe('2026-06-09')
    expect(diaDe('lixo')).toBe('')
    expect(diaDe(null)).toBe('')
  })
  it('addDiasYMD soma/subtrai sem off-by-one (fuso-agnóstico)', () => {
    expect(addDiasYMD(HOJE, 1)).toBe('2026-06-10')
    expect(addDiasYMD(HOJE, -1)).toBe('2026-06-08')
    expect(addDiasYMD('2026-01-01', -1)).toBe('2025-12-31')
  })
})

// ── Filtros ───────────────────────────────────────────────────────────────────
describe('filtrarLogs', () => {
  const dados = [
    log({ acao: 'excluir', entidade: 'contrato', ator_id: 'u1', sensivel: true, criado_em: '2026-06-09T10:00:00Z', descricao: 'removeu contrato' }),
    log({ acao: 'editar', entidade: 'lancamento', ator_id: 'u2', criado_em: '2026-06-01T10:00:00Z' }),
    log({ acao: 'login', entidade: 'sessao', ator_id: 'u1', criado_em: '2026-05-20T10:00:00Z' }),
  ]
  it('filtra por ação/entidade/ator', () => {
    expect(filtrarLogs(dados, { acao: 'excluir' })).toHaveLength(1)
    expect(filtrarLogs(dados, { entidade: 'lancamento' })).toHaveLength(1)
    expect(filtrarLogs(dados, { ator: 'u1' })).toHaveLength(2)
  })
  it('filtra por sensível e por segurança', () => {
    expect(filtrarLogs(dados, { sensivel: true })).toHaveLength(1)
    expect(filtrarLogs(dados, { seguranca: true })).toHaveLength(1)
  })
  it('filtra por período inclusivo (de/até)', () => {
    expect(filtrarLogs(dados, { de: '2026-06-01', ate: '2026-06-09' })).toHaveLength(2)
    expect(filtrarLogs(dados, { de: '2026-06-09' })).toHaveLength(1)
  })
  it('busca textual cobre descrição/ator/entidade', () => {
    expect(filtrarLogs(dados, { busca: 'removeu' })).toHaveLength(1)
    expect(filtrarLogs(dados, { busca: 'CONTRATO' })).toHaveLength(1)
  })
})

// ── Agregação ─────────────────────────────────────────────────────────────────
describe('resumoAuditoria', () => {
  it('conta categorias, atores distintos e ranking por ação', () => {
    const r = resumoAuditoria([
      log({ acao: 'excluir', sensivel: true, ator_id: 'u1' }),
      log({ acao: 'exportar', sensivel: true, ator_id: 'u1' }),
      log({ acao: 'login', ator_id: 'u2' }),
      log({ acao: 'login_falha', sensivel: true, ator_id: 'u2' }),
      log({ acao: 'login', ator_id: 'u2' }),
    ])
    expect(r.total).toBe(5)
    expect(r.sensiveis).toBe(3)
    expect(r.exclusoes).toBe(1)
    expect(r.exportacoes).toBe(1)
    expect(r.logins).toBe(2)
    expect(r.loginsFalha).toBe(1)
    expect(r.atores).toBe(2)
    expect(r.porAcao[0]).toMatchObject({ acao: 'login', n: 2 })
  })
})

describe('atividadePorDia', () => {
  it('monta série contínua e conta por dia', () => {
    const serie = atividadePorDia(
      [log({ criado_em: '2026-06-09T01:00:00Z' }), log({ criado_em: '2026-06-09T05:00:00Z' }), log({ criado_em: '2026-06-08T05:00:00Z' })],
      HOJE, 7,
    )
    expect(serie).toHaveLength(7)
    expect(serie[serie.length - 1]).toEqual({ dia: '2026-06-09', n: 2 })
    expect(serie[serie.length - 2]).toEqual({ dia: '2026-06-08', n: 1 })
  })
})

// ── Logins suspeitos ──────────────────────────────────────────────────────────
describe('loginsSuspeitos', () => {
  it('marca login de IP novo para o ator', () => {
    const logs = [
      { ...log({ acao: 'login', ip: '1.1.1.1', criado_em: '2026-06-01T10:00:00Z' }), id: 'a' },
      { ...log({ acao: 'login', ip: '9.9.9.9', criado_em: '2026-06-02T10:00:00Z' }), id: 'b' },
    ]
    const s = loginsSuspeitos(logs)
    expect(s.has('a')).toBe(false) // primeiro IP é a linha de base
    expect(s.has('b')).toBe(true)  // IP nunca visto antes
  })
  it('marca login bem-sucedido após várias falhas', () => {
    const logs = [
      { ...log({ acao: 'login_falha', ator_id: 'u1', ip: '1.1.1.1', sucesso: false, criado_em: '2026-06-01T10:00:00Z' }), id: 'f1' },
      { ...log({ acao: 'login_falha', ator_id: 'u1', ip: '1.1.1.1', sucesso: false, criado_em: '2026-06-01T10:01:00Z' }), id: 'f2' },
      { ...log({ acao: 'login_falha', ator_id: 'u1', ip: '1.1.1.1', sucesso: false, criado_em: '2026-06-01T10:02:00Z' }), id: 'f3' },
      { ...log({ acao: 'login', ator_id: 'u1', ip: '1.1.1.1', sucesso: true, criado_em: '2026-06-01T10:03:00Z' }), id: 'ok' },
    ]
    expect(loginsSuspeitos(logs).has('ok')).toBe(true)
  })
})

// ── User-agent & CSV ──────────────────────────────────────────────────────────
describe('resumirUserAgent', () => {
  it('extrai navegador e SO', () => {
    expect(resumirUserAgent('Mozilla/5.0 (Windows NT 10.0) ... Chrome/120 Safari/537')).toBe('Chrome · Windows')
    expect(resumirUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ... Safari')).toContain('iOS')
    expect(resumirUserAgent(null)).toBe('—')
  })
})

describe('logsParaCSV', () => {
  it('gera cabeçalho + linhas e resume o diff, escapando aspas', () => {
    const csv = logsParaCSV([
      log({ acao: 'editar', entidade: 'lancamento', antes: { valor: 100 }, depois: { valor: 200 }, descricao: 'ajuste "rápido"' }),
    ])
    const linhas = csv.split('\r\n')
    expect(linhas[0]).toContain('Data/hora (ISO)')
    expect(linhas[1]).toContain('Edição')
    expect(linhas[1]).toContain('valor: 100 → 200')
    expect(linhas[1]).toContain('ajuste ""rápido""') // aspas escapadas
  })
})

describe('isMissingTable', () => {
  it('reconhece os códigos de tabela ausente', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
