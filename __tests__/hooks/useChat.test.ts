import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeQueryBuilder } from '../helpers/supabaseMock'
import { useChat } from '@/hooks/useChat'

// ── Mocks (vi.hoisted ensures variables exist before the factory runs) ────────

const {
  mockFrom,
  mockRemoveChannel,
  mockChannel,
  mockOn,
  mockSubscribe,
} = vi.hoisted(() => {
  const mockSubscribe = vi.fn().mockReturnThis()
  const mockOn        = vi.fn().mockImplementation(
    (_event: string, _filter: unknown, cb: (payload: { new: unknown }) => void) => {
      ;(globalThis as Record<string, unknown>).__chatCb = cb
      return { on: mockOn, subscribe: mockSubscribe }
    },
  )
  return {
    mockFrom:          vi.fn(),
    mockRemoveChannel: vi.fn(),
    mockSubscribe,
    mockOn,
    mockChannel: vi.fn().mockReturnValue({ on: mockOn, subscribe: mockSubscribe }),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from:          mockFrom,
    channel:       mockChannel,
    removeChannel: mockRemoveChannel,
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const triggerRealtime = (payload: { new: unknown }) => {
  const cb = (globalThis as Record<string, unknown>).__chatCb as ((p: { new: unknown }) => void) | undefined
  cb?.(payload)
}

const CONV_ID = 'conv-abc'
const MSG_1 = { id: 'm1', conversation_id: CONV_ID, sender_id: 'u1', text: 'Oi',  created_at: '2025-01-01T10:00:00Z' }
const MSG_2 = { id: 'm2', conversation_id: CONV_ID, sender_id: 'u2', text: 'Olá', created_at: '2025-01-01T10:01:00Z' }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (globalThis as Record<string, unknown>).__chatCb
    mockChannel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe })
    mockOn.mockImplementation(
      (_event: string, _filter: unknown, cb: (payload: { new: unknown }) => void) => {
        ;(globalThis as Record<string, unknown>).__chatCb = cb
        return { on: mockOn, subscribe: mockSubscribe }
      },
    )
  })

  it('starts with loading=true and empty messages', () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    const { result } = renderHook(() => useChat(CONV_ID))
    expect(result.current.loading).toBe(true)
    expect(result.current.messages).toEqual([])
  })

  it('loads messages from Supabase on mount', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [MSG_1, MSG_2], error: null }))
    const { result } = renderHook(() => useChat(CONV_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.messages).toEqual([MSG_1, MSG_2])
    expect(mockFrom).toHaveBeenCalledWith('mensagens')
  })

  it('sets loading=false after fetch completes', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    const { result } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('does not fetch when conversationId is empty', async () => {
    const { result } = renderHook(() => useChat(''))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.loading).toBe(true)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('subscribes to realtime channel on mount', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(mockChannel).toHaveBeenCalledWith(`chat:${CONV_ID}`))
    expect(mockSubscribe).toHaveBeenCalled()
  })

  it('unsubscribes from channel on unmount', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    const { unmount } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(mockChannel).toHaveBeenCalled())
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })

  it('appends realtime INSERT to messages (new id)', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [MSG_1], error: null }))
    const { result } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { triggerRealtime({ new: MSG_2 }) })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]).toEqual(MSG_2)
  })

  it('does not add duplicate on realtime INSERT if message already present', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [MSG_1], error: null }))
    const { result } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { triggerRealtime({ new: MSG_1 }) })

    expect(result.current.messages).toHaveLength(1)
  })

  it('sendMessage returns false for empty or whitespace text', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))
    const { result } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let ok: boolean
    await act(async () => { ok = await result.current.sendMessage('   ', 'u1') })
    expect(ok!).toBe(false)
    // Only the initial load call, no insert
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('sendMessage appends message and returns true on success', async () => {
    mockFrom
      .mockReturnValueOnce(makeQueryBuilder({ data: [MSG_1], error: null })) // load
      .mockReturnValue(makeQueryBuilder({ data: MSG_2, error: null }))        // insert

    const { result } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let ok: boolean
    await act(async () => { ok = await result.current.sendMessage(MSG_2.text, MSG_2.sender_id) })

    expect(ok!).toBe(true)
    expect(result.current.messages).toContainEqual(MSG_2)
  })

  it('sendMessage returns false on DB error', async () => {
    mockFrom
      .mockReturnValueOnce(makeQueryBuilder({ data: [], error: null }))
      .mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'fail' } }))

    const { result } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let ok: boolean
    await act(async () => { ok = await result.current.sendMessage('Oi', 'u1') })
    expect(ok!).toBe(false)
  })

  it('sendMessage does not duplicate if message already in list (realtime race)', async () => {
    mockFrom
      .mockReturnValueOnce(makeQueryBuilder({ data: [MSG_1], error: null }))
      .mockReturnValue(makeQueryBuilder({ data: MSG_1, error: null })) // same id returned

    const { result } = renderHook(() => useChat(CONV_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.sendMessage(MSG_1.text, MSG_1.sender_id) })

    expect(result.current.messages).toHaveLength(1)
  })
})
