// ---------------------------------------------------------------------------
// Runway.jsx
// ---------------------------------------------------------------------------
// A single 3000 m runway laid over the flattened airport area. The asphalt,
// edge stripes, centreline dashes, threshold "piano keys" and runway numbers
// are all painted onto a procedurally generated canvas texture — no image
// assets to ship. The runway runs north/south (heading 36 at the spawn end).
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import * as THREE from 'three'
import { RUNWAY_LENGTH, RUNWAY_WIDTH, AIRPORT_ELEVATION } from '../physics/constants.js'

function buildRunwayTexture() {
  // Aspect roughly matches the real runway (long and thin) for crisp markings.
  const w = 128
  const h = 2048
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  // Asphalt base.
  ctx.fillStyle = '#3a3a3e'
  ctx.fillRect(0, 0, w, h)

  // Edge stripes down both sides.
  ctx.fillStyle = '#d8d8d8'
  const edge = w * 0.06
  ctx.fillRect(w * 0.08, 0, edge, h)
  ctx.fillRect(w * 0.86, 0, edge, h)

  // Dashed centreline.
  ctx.fillStyle = '#e8e8e8'
  const dashLen = h * 0.03
  const gap = h * 0.02
  for (let y = h * 0.1; y < h * 0.9; y += dashLen + gap) {
    ctx.fillRect(w / 2 - w * 0.02, y, w * 0.04, dashLen)
  }

  // Threshold "piano keys" at each end.
  ctx.fillStyle = '#f0f0f0'
  const keyCount = 6
  const keyW = (w * 0.7) / (keyCount * 2 - 1)
  for (let k = 0; k < keyCount; k++) {
    const x = w * 0.15 + k * keyW * 2
    ctx.fillRect(x, h * 0.02, keyW, h * 0.04)
    ctx.fillRect(x, h * 0.94, keyW, h * 0.04)
  }

  // Runway numbers (36 at the south/spawn threshold, 18 at the north end).
  ctx.fillStyle = '#f0f0f0'
  ctx.textAlign = 'center'
  ctx.font = `bold ${w * 0.28}px sans-serif`
  ctx.save()
  ctx.translate(w / 2, h * 0.12)
  ctx.fillText('36', 0, 0)
  ctx.restore()
  ctx.save()
  ctx.translate(w / 2, h * 0.9)
  ctx.rotate(Math.PI)
  ctx.fillText('18', 0, 0)
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function Runway() {
  const texture = useMemo(() => buildRunwayTexture(), [])
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(RUNWAY_WIDTH, RUNWAY_LENGTH)
    geom.rotateX(-Math.PI / 2) // lie flat; length now runs along world Z
    return geom
  }, [])

  return (
    <mesh geometry={geometry} position={[0, AIRPORT_ELEVATION + 0.15, 0]} receiveShadow>
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
    </mesh>
  )
}
