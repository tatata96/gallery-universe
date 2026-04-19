import React, { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Camera } from '../../core/types'
import './CategoryNav.css'

interface Group {
  key: string
  count: number
}

interface CategoryNavProps {
  groups: Group[]
  cameraRef: RefObject<Camera>
  groupCentersRef: RefObject<Map<string, { x: number; y: number }>>
  onSelect: (key: string) => void
  trackStyle?: React.CSSProperties
  buttonStyle?: React.CSSProperties
  buttonActiveStyle?: React.CSSProperties
}

export function CategoryNav({ groups, cameraRef, groupCentersRef, onSelect, trackStyle, buttonStyle, buttonActiveStyle }: CategoryNavProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const activeKeyRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const rafRef = useRef<number>(0)

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
    <div className="category-nav-outer">
      <div className="category-nav-track" ref={scrollRef} style={trackStyle}>
        {groups.map(({ key, count }) => (
          <button
            key={key}
            ref={(el) => { if (el) itemRefs.current.set(key, el); else itemRefs.current.delete(key) }}
            className={`category-nav-item${activeKey === key ? ' active' : ''}`}
            style={activeKey === key ? { ...buttonStyle, ...buttonActiveStyle } : buttonStyle}
            onClick={() => onSelect(key)}
          >
            {key} ({count})
          </button>
        ))}
      </div>
    </div>
  )
}
