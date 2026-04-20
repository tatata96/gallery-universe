import React, { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Camera } from '../../core/types'

const STYLE_ID = 'gallery-universe-nav'

function injectScrollbarStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = '[data-gu-nav]::-webkit-scrollbar{display:none}'
  document.head.appendChild(el)
}

interface Group {
  key: string
  count: number
}

export interface CategoryNavProps {
  groups: Group[]
  cameraRef: RefObject<Camera>
  groupCentersRef: RefObject<Map<string, { x: number; y: number }>>
  onSelect: (key: string) => void
  outerStyle?: React.CSSProperties
  trackStyle?: React.CSSProperties
  buttonStyle?: React.CSSProperties
  buttonHoverStyle?: React.CSSProperties
  buttonActiveStyle?: React.CSSProperties
}

const defaultOuterStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 10,
}

const defaultTrackStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  background: 'rgba(0,0,0,0.08)',
  borderRadius: 10,
  padding: 3,
  overflowX: 'auto',
  maxWidth: '70vw',
  pointerEvents: 'all',
  scrollbarWidth: 'none',
}

const defaultButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  borderRadius: 8,
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 500,
  color: '#555',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'background 0.2s ease, color 0.2s ease',
}

const defaultButtonHoverStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.06)',
}

const defaultButtonActiveStyle: React.CSSProperties = {
  background: '#222',
  color: '#fff',
  fontWeight: 600,
}

export function CategoryNav({ groups, cameraRef, groupCentersRef, onSelect, outerStyle, trackStyle, buttonStyle, buttonHoverStyle, buttonActiveStyle }: CategoryNavProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const activeKeyRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const rafRef = useRef<number>(0)

  useEffect(() => { injectScrollbarStyle() }, [])

  useEffect(() => {
    function tick() {
      const centers = groupCentersRef.current
      const cam = cameraRef.current
      if (centers.size > 0) {
        let minDist = Infinity
        let closest: string | null = null
        for (const [key, center] of centers) {
          const dist = Math.abs(center.x - cam.x)
          if (dist < minDist) {
            minDist = dist
            closest = key
          }
        }
        if (closest !== null && closest !== activeKeyRef.current) {
          activeKeyRef.current = closest
          setActiveKey(closest)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [cameraRef, groupCentersRef])

  useEffect(() => {
    if (!activeKey || !scrollRef.current) return
    const el = itemRefs.current.get(activeKey)
    if (!el) return
    const container = scrollRef.current
    const itemCenter = el.offsetLeft + el.offsetWidth / 2
    container.scrollTo({ left: itemCenter - container.offsetWidth / 2, behavior: 'smooth' })
  }, [activeKey])

  return (
    <div style={{ ...defaultOuterStyle, ...outerStyle }}>
      <div data-gu-nav="" ref={scrollRef} style={{ ...defaultTrackStyle, ...trackStyle }}>
        {groups.map(({ key, count }) => {
          const isActive = activeKey === key
          const isHovered = hoveredKey === key && !isActive

          const computedStyle = {
            ...defaultButtonStyle,
            ...buttonStyle,
            ...(isHovered ? { ...defaultButtonHoverStyle, ...buttonHoverStyle } : {}),
            ...(isActive ? { ...defaultButtonActiveStyle, ...buttonActiveStyle } : {}),
          }

          return (
            <button
              key={key}
              ref={(el) => { if (el) itemRefs.current.set(key, el); else itemRefs.current.delete(key) }}
              style={computedStyle}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => onSelect(key)}
            >
              {key} ({count})
            </button>
          )
        })}
      </div>
    </div>
  )
}
