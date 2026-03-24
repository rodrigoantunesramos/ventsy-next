import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeQueryBuilder } from '../helpers/supabaseMock'
import { useFavorites } from '@/hooks/useFavorites'

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockFrom, mockGetSession } = vi.hoisted(() => ({
  mockFrom:       vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: { getSession: mockGetSession },
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

const NO_SESSION  = { data: { session: null } }
const makeSession = (uid = 'user-1') => ({
  data: { session: { user: { id: uid } } },
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // ── Initialisation ──────────────────────────────────────────────────────

  it('starts with loading=true and empty favorites', () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const { result } = renderHook(() => useFavorites())
    expect(result.current.loading).toBe(true)
    expect(result.current.favorites).toEqual([])
  })

  it('loads favorites from localStorage when not authenticated', async () => {
    localStorage.setItem('ventsy_favs', JSON.stringify(['10', '20']))
    mockGetSession.mockResolvedValue(NO_SESSION)

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.favorites).toEqual(['10', '20'])
    expect(result.current.isLoggedIn).toBe(false)
  })

  it('starts with empty favorites when localStorage has no entry', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.favorites).toEqual([])
  })

  it('loads favorites from Supabase when authenticated', async () => {
    mockGetSession.mockResolvedValue(makeSession())
    mockFrom.mockReturnValue(
      makeQueryBuilder({ data: [{ property_id: 5 }, { property_id: 9 }], error: null }),
    )

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // property_id (number) must be converted to string at the DB boundary
    expect(result.current.favorites).toEqual(['5', '9'])
    expect(result.current.isLoggedIn).toBe(true)
  })

  it('exposes correct userId when authenticated', async () => {
    mockGetSession.mockResolvedValue(makeSession('uid-xyz'))
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.userId).toBe('uid-xyz')
  })

  // ── isFavorite ──────────────────────────────────────────────────────────

  it('isFavorite returns true for a favorite and false otherwise', async () => {
    localStorage.setItem('ventsy_favs', JSON.stringify(['42']))
    mockGetSession.mockResolvedValue(NO_SESSION)

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.isFavorite('42')).toBe(true)
    expect(result.current.isFavorite('99')).toBe(false)
  })

  // ── toggle (unauthenticated) ────────────────────────────────────────────

  it('toggle adds a new favorite to localStorage when not logged in', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggle('7') })

    expect(result.current.favorites).toContain('7')
    expect(JSON.parse(localStorage.getItem('ventsy_favs') || '[]')).toContain('7')
  })

  it('toggle removes an existing favorite from localStorage when not logged in', async () => {
    localStorage.setItem('ventsy_favs', JSON.stringify(['7', '8']))
    mockGetSession.mockResolvedValue(NO_SESSION)

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggle('7') })

    expect(result.current.favorites).not.toContain('7')
    expect(result.current.favorites).toContain('8')
    expect(JSON.parse(localStorage.getItem('ventsy_favs') || '[]')).not.toContain('7')
  })

  it('does NOT call Supabase when toggling without a session', async () => {
    mockGetSession.mockResolvedValue(NO_SESSION)
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggle('5') })

    expect(mockFrom).not.toHaveBeenCalled()
  })

  // ── toggle (authenticated) ──────────────────────────────────────────────

  it('toggle optimistically adds favorite and calls supabase.insert when logged in', async () => {
    mockGetSession.mockResolvedValue(makeSession())
    mockFrom
      .mockReturnValueOnce(makeQueryBuilder({ data: [], error: null }))           // initial load
      .mockReturnValue(makeQueryBuilder({ data: null, error: null }))             // insert

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggle('3') })

    expect(result.current.favorites).toContain('3')
    const tables = (mockFrom as ReturnType<typeof vi.fn>).mock.calls.map(([t]: string[]) => t)
    expect(tables).toContain('favoritos')
  })

  it('toggle optimistically removes favorite and calls supabase.delete when logged in', async () => {
    mockGetSession.mockResolvedValue(makeSession())
    mockFrom
      .mockReturnValueOnce(makeQueryBuilder({ data: [{ property_id: 3 }], error: null })) // load
      .mockReturnValue(makeQueryBuilder({ data: null, error: null }))                      // delete

    const { result } = renderHook(() => useFavorites())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.favorites).toContain('3')
    })

    await act(async () => { await result.current.toggle('3') })

    expect(result.current.favorites).not.toContain('3')
    const tables = (mockFrom as ReturnType<typeof vi.fn>).mock.calls.map(([t]: string[]) => t)
    expect(tables).toContain('favoritos')
  })
})
