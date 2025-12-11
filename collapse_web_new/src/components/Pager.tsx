import React, { useEffect, useMemo, useRef, useState } from 'react'

type PagerProps = {
  pageIndex: number
  onPageIndexChange?: (index: number) => void
  children: React.ReactNode
}

const SWIPE_THRESHOLD_PX = 60

export default function Pager({ pageIndex, onPageIndexChange, children }: PagerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)

  const pages = useMemo(() => React.Children.toArray(children), [children])
  const maxIndex = pages.length > 0 ? pages.length - 1 : 0
  const clampIndex = (value: number) => clamp(value, 0, maxIndex)

  const releasePointer = () => {
    if (pointerIdRef.current === null) return
    pointerIdRef.current = null
    setDragOffset(0)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    setDragOffset(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    setDragOffset(event.clientX - startXRef.current)
  }

  const commitSwipe = (delta: number) => {
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    const direction = delta < 0 ? 1 : -1
    const next = clampIndex(pageIndex + direction)
    if (next !== pageIndex) onPageIndexChange?.(next)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    const delta = event.clientX - startXRef.current
    releasePointer()
    commitSwipe(delta)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onPageIndexChange?.(clampIndex(pageIndex - 1))
      if (event.key === 'ArrowRight') onPageIndexChange?.(clampIndex(pageIndex + 1))
    }
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  }, [pageIndex, clampIndex, onPageIndexChange])

  const dragPercent = (() => {
    const width = containerRef.current?.clientWidth || 1
    return (dragOffset / width) * 100
  })()

  const pagerStyle: React.CSSProperties & { ['--pager-offset']?: string } = {
    '--pager-offset': `calc(${clampIndex(pageIndex) * 100}% - ${dragPercent}%)`,
  }

  return (
    <div className="pager" ref={containerRef} tabIndex={0}>
      <div
        className="pager-inner"
        style={pagerStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => {
          if (pointerIdRef.current === event.pointerId) {
            const delta = event.clientX - startXRef.current
            releasePointer()
            commitSwipe(delta)
          }
        }}
        onPointerLeave={(event) => {
          if (pointerIdRef.current === event.pointerId) {
            const delta = event.clientX - startXRef.current
            releasePointer()
            commitSwipe(delta)
          }
        }}
      >
        {pages.map((page, index) => (
          <section className="page" key={index} aria-hidden={index !== pageIndex}>
            {page}
          </section>
        ))}
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min
  if (value > max) return max
  return value
}
