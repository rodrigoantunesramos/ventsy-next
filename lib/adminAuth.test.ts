import { describe, it, expect } from 'vitest'
import { adminPode, type AdminMembro } from './adminAuth'

const superAdmin: AdminMembro = {
  usuario_id: 'sa',
  papel: 'super_admin',
  permissoes: {},
  ativo: true,
}

const staff = (permissoes: AdminMembro['permissoes']): AdminMembro => ({
  usuario_id: 'u',
  papel: 'staff',
  permissoes,
  ativo: true,
})

describe('adminPode', () => {
  it('super_admin pode tudo, inclusive gerir acessos', () => {
    expect(adminPode(superAdmin, 'usuarios', 'excluir')).toBe(true)
    expect(adminPode(superAdmin, 'financeiro', 'editar')).toBe(true)
    expect(adminPode(superAdmin, 'acessos', 'editar')).toBe(true)
  })

  it('staff sem permissão no módulo não vê', () => {
    expect(adminPode(staff({}), 'usuarios', 'ver')).toBe(false)
  })

  it('staff com leitura vê, mas não edita nem exclui', () => {
    const m = staff({ usuarios: 'leitura' })
    expect(adminPode(m, 'usuarios', 'ver')).toBe(true)
    expect(adminPode(m, 'usuarios', 'editar')).toBe(false)
    expect(adminPode(m, 'usuarios', 'excluir')).toBe(false)
  })

  it('staff com edicao edita/cria/exporta, mas não exclui', () => {
    const m = staff({ propriedades: 'edicao' })
    expect(adminPode(m, 'propriedades', 'editar')).toBe(true)
    expect(adminPode(m, 'propriedades', 'criar')).toBe(true)
    expect(adminPode(m, 'propriedades', 'exportar')).toBe(true)
    expect(adminPode(m, 'propriedades', 'excluir')).toBe(false)
  })

  it('staff com total faz tudo no módulo', () => {
    const m = staff({ cupons: 'total' })
    expect(adminPode(m, 'cupons', 'excluir')).toBe(true)
  })

  it('staff NUNCA acessa gestão de acessos da equipe, mesmo com total', () => {
    expect(adminPode(staff({ acessos: 'total' }), 'acessos', 'ver')).toBe(false)
  })

  it('permissão num módulo não vaza para outro', () => {
    const m = staff({ financeiro: 'total' })
    expect(adminPode(m, 'financeiro', 'excluir')).toBe(true)
    expect(adminPode(m, 'usuarios', 'ver')).toBe(false)
  })
})
