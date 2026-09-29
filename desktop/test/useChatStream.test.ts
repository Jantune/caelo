// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatStream } from '../src/renderer/src/lib/useChatStream'
import * as api from '../src/renderer/src/lib/api'

vi.mock('../src/renderer/src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/renderer/src/lib/api')>('../src/renderer/src/lib/api')
  return {
    ...actual,
    streamChat: vi.fn()
  }
})

describe('useChatStream — per-conversation streaming state', () => {
  const conn = { baseUrl: 'http://localhost:8000', token: 'test-token' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('izoluje stan streamingu per-konwersacja i udostępnia poprawny streaming dla activeId', () => {
    let doneCb: ((full: string) => void) | undefined
    const mockStop = vi.fn()

    vi.mocked(api.streamChat).mockImplementation((_conn, _req, handlers) => {
      doneCb = handlers.onDone
      return { stop: mockStop }
    })

    const { result, rerender } = renderHook(
      ({ activeId }) => useChatStream(conn, activeId),
      { initialProps: { activeId: 'convo-A' } }
    )

    expect(result.current.streaming).toBe(false)
    expect(result.current.isStreaming('convo-A')).toBe(false)
    expect(result.current.isStreaming('convo-B')).toBe(false)

    // Start stream for convo-A
    act(() => {
      result.current.start(
        'convo-A',
        { messages: [], model: 'grok-4.20-multi-agent-0309', temperature: 0.7 },
        { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() }
      )
    })

    expect(result.current.isStreaming('convo-A')).toBe(true)
    expect(result.current.streaming).toBe(true) // activeId is convo-A
    expect(result.current.isStreaming('convo-B')).toBe(false)
    expect(result.current.streamingIds).toEqual(['convo-A'])

    // Switch activeId to new conversation convo-B (np. kliknięcie New Chat)
    rerender({ activeId: 'convo-B' })

    // convo-B NIE jest w trakcie streamingu -> streaming (i przycisk Stop) to false!
    expect(result.current.streaming).toBe(false)
    expect(result.current.isStreaming('convo-B')).toBe(false)
    // convo-A nadal streamuje w tle!
    expect(result.current.isStreaming('convo-A')).toBe(true)
    expect(result.current.streamingIds).toEqual(['convo-A'])

    // convo-A kończy generowanie
    act(() => {
      doneCb?.('full answer for A')
    })

    expect(result.current.isStreaming('convo-A')).toBe(false)
    expect(result.current.streamingIds).toEqual([])
  })

  it('stop(id) zatrzymuje tylko wskazaną rozmowę', () => {
    const stopA = vi.fn()
    const stopB = vi.fn()

    vi.mocked(api.streamChat).mockImplementation((_conn, req) => {
      if (req.model === 'model-A') return { stop: stopA }
      return { stop: stopB }
    })

    const { result } = renderHook(() => useChatStream(conn, 'convo-B'))

    act(() => {
      result.current.start(
        'convo-A',
        { messages: [], model: 'model-A', temperature: 0.7 },
        { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() }
      )
      result.current.start(
        'convo-B',
        { messages: [], model: 'model-B', temperature: 0.7 },
        { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() }
      )
    })

    expect(result.current.isStreaming('convo-A')).toBe(true)
    expect(result.current.isStreaming('convo-B')).toBe(true)

    act(() => {
      result.current.stop('convo-A')
    })

    expect(stopA).toHaveBeenCalled()
    expect(stopB).not.toHaveBeenCalled()
    expect(result.current.isStreaming('convo-A')).toBe(false)
    expect(result.current.isStreaming('convo-B')).toBe(true)
  })
})
