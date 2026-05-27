// ---------------------------------------------------------------------------
// Terrain.jsx
// ---------------------------------------------------------------------------
// Renders the procedural heightfield as a single coloured mesh. The geometry
// is built once by sampling heightAt() — the SAME function the physics uses
// for ground collision — so what you see is exactly what you can hit.
// Vertices are tinted by elevation (green lowlands -> brown -> grey peaks).
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import * as THREE from 'three'
import { heightAt, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './terrain.js'

const LOW = new THREE.Color('#4a7c3f') // grassy lowland
const MID = new THREE.Color('#6b6147') // foothills / rock
const HIGH = new THREE.Color('#8a8a90') // bare mountain
const SNOW = new THREE.Color('#e8eef2') // peaks

function colorForHeight(h, target) {
  if (h < 60) return target.copy(LOW)
  if (h < 220) return target.copy(LOW).lerp(MID, (h - 60) / 160)
  if (h < 480) return target.copy(MID).lerp(HIGH, (h - 220) / 260)
  return target.copy(HIGH).lerp(SNOW, Math.min(1, (h - 480) / 200))
}

export default function Terrain() {
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
    const pos = geom.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()

    // Plane vertices are (x, y, 0). After we rotateX(-90deg) below, the local
    // +Z becomes world +Y (height) and local +Y becomes world -Z. So a vertex
    // at world (x, h, z) corresponds to local (x, -z) with its z set to h.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const h = heightAt(x, -y)
      pos.setZ(i, h)
      colorForHeight(h, c)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geom.computeVertexNormals()
    geom.rotateX(-Math.PI / 2) // lay the plane flat with the height along world +Y
    return geom
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}
