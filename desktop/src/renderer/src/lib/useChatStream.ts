import { useEffect, useRef, useState } from 'react'
import {
  streamChat,
  type ChatStreamHandle,
  type ChatStreamHandlers,
  type ChatStreamPayload,
  type Conn
} from './api'

/**
 * Mechanika streamingu czatu: trzyma stan streamingu per-konwersacja,
 * pozwalając na jednoczesne streamowanie w tle i przełączanie na nowe/inne rozmowy.
 * Przerywa wszystkie aktywne strumienie przy odmontowaniu.
 */
export function useChatStream(
  conn: Conn,
  activeId?: string | null
): {
  streaming: boolean
  isStreaming: (convoId?: string | null) => boolean
  streamingIds: string[]
  start: (
    convoIdOrReq: string | ChatStreamPayload,
    reqOrHandlers: ChatStreamPayload | ChatStreamHandlers,
    handlers?: ChatStreamHandlers
  ) => void
  stop: (convoId?: string | null) => void
  stopAll: () => void
} {
  const [streamingMap, setStreamingMap] = useState<Record<string, boolean>>({})
  const handlesRef = useRef<Record<string, ChatStreamHandle>>({})

  useEffect(() => {
    return () => {
      for (const h of Object.values(handlesRef.current)) {
        try {
          h.stop()
        } catch {
          /* ignore */
        }
      }
      handlesRef.current = {}
    }
  }, [])

  function isStreaming(convoId?: string | null): boolean {
    const id = convoId ?? activeId
    return id ? Boolean(streamingMap[id]) : false
  }

  function start(
    convoIdOrReq: string | ChatStreamPayload,
    reqOrHandlers: ChatStreamPayload | ChatStreamHandlers,
    handlersArg?: ChatStreamHandlers
  ): void {
    let convoId: string
    let req: ChatStreamPayload
    let handlers: ChatStreamHandlers

    if (typeof convoIdOrReq === 'string') {
      convoId = convoIdOrReq
      req = reqOrHandlers as ChatStreamPayload
      handlers = handlersArg as ChatStreamHandlers
    } else {
      convoId = activeId || 'default'
      req = convoIdOrReq
      handlers = reqOrHandlers as ChatStreamHandlers
    }

    // Jeśli dana rozmowa już streamuje, zatrzymaj poprzedni strumień
    if (handlesRef.current[convoId]) {
      try {
        handlesRef.current[convoId].stop()
      } catch {
        /* ignore */
      }
      delete handlesRef.current[convoId]
    }

    setStreamingMap((prev) => ({ ...prev, [convoId]: true }))

    const handle = streamChat(conn, req, {
      onDelta: handlers.onDelta,
      // M10-F1/F2/F6: forward live-search activity, sources and usage as-is.
      onTool: handlers.onTool,
      onCitations: handlers.onCitations,
      onUsage: handlers.onUsage,
      onArtifact: handlers.onArtifact, // M20: media generated mid-turn (render inline)
      onDone: (full) => {
        delete handlesRef.current[convoId]
        setStreamingMap((prev) => {
          if (!prev[convoId]) return prev
          const next = { ...prev }
          delete next[convoId]
          return next
        })
        handlers.onDone(full)
      },
      onError: (err) => {
        delete handlesRef.current[convoId]
        setStreamingMap((prev) => {
          if (!prev[convoId]) return prev
          const next = { ...prev }
          delete next[convoId]
          return next
        })
        handlers.onError(err)
      }
    })

    handlesRef.current[convoId] = handle
  }

  function stop(convoId?: string | null): void {
    const id = convoId ?? activeId
    if (!id) return
    if (handlesRef.current[id]) {
      try {
        handlesRef.current[id].stop()
      } catch {
        /* ignore */
      }
      delete handlesRef.current[id]
      setStreamingMap((prev) => {
        if (!prev[id]) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  function stopAll(): void {
    for (const h of Object.values(handlesRef.current)) {
      try {
        h.stop()
      } catch {
        /* ignore */
      }
    }
    handlesRef.current = {}
    setStreamingMap({})
  }

  const streaming = activeId ? Boolean(streamingMap[activeId]) : Object.keys(streamingMap).length > 0
  const streamingIds = Object.keys(streamingMap)

  return { streaming, isStreaming, streamingIds, start, stop, stopAll }
}
