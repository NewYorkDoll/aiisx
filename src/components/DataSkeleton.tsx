import type { CSSProperties } from 'react'

type SkeletonProps = {
  className?: string
  height?: string
  width?: string
}

export function Skeleton({ className = '', height, width }: SkeletonProps) {
  return <span
    aria-hidden="true"
    className={`data-skeleton ${className}`.trim()}
    style={{ '--skeleton-height': height, '--skeleton-width': width } as CSSProperties}
  />
}

export function RouteSkeleton() {
  return <div className="route-skeleton" aria-label="正在载入页面" aria-busy="true">
    <Skeleton width="150px" height="12px" />
    <Skeleton width="min(520px, 78%)" height="64px" />
    <Skeleton width="min(420px, 66%)" height="14px" />
    <Skeleton width="100%" height="220px" />
  </div>
}
