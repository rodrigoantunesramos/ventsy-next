/**
 * Supabase query builder mock.
 * Each method returns `this` so chains work; the object itself is thenable
 * so `await builder` resolves to `resolveWith`.
 */
export function makeQueryBuilder(resolveWith: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> & PromiseLike<typeof resolveWith> = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    neq:         vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    insert:      vi.fn().mockReturnThis(),
    delete:      vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    upsert:      vi.fn().mockReturnThis(),
    single:      vi.fn().mockResolvedValue(resolveWith),
    maybeSingle: vi.fn().mockResolvedValue(resolveWith),
    then:    (ok: ((v: typeof resolveWith) => unknown) | null, err?: ((e: unknown) => unknown) | null) =>
               Promise.resolve(resolveWith).then(ok ?? undefined, err ?? undefined),
    catch:   (fn: (e: unknown) => unknown) => Promise.resolve(resolveWith).catch(fn),
    finally: (fn: () => void)              => Promise.resolve(resolveWith).finally(fn),
  } as unknown as typeof builder
  return builder
}
