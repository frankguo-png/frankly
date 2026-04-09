'use client'

import { useRef, useEffect } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  pulseSpeed: number
  pulsePhase: number
}

interface NeuralLink {
  a: number
  b: number
  age: number
  maxLife: number
  particlePos: number
}

export function DotGridCanvas({ className, streaming = false }: { className?: string; streaming?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamingRef = useRef(streaming)
  streamingRef.current = streaming
  const stateRef = useRef({
    particles: [] as Particle[],
    links: [] as NeuralLink[],
    mouse: { x: -1000, y: -1000, active: false },
    raf: 0,
    dpr: 1,
    time: 0,
    w: 0,
    h: 0,
    linkTimer: 0,
    wavePhase: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    const s = stateRef.current
    s.dpr = Math.min(window.devicePixelRatio || 1, 2)

    function spawnParticles(w: number, h: number) {
      const particles: Particle[] = []
      // Sparse glowing particles — ~1 per 8000px²
      const count = Math.floor((w * h) / 8000)
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.12,
          size: 1 + Math.random() * 1.5,
          alpha: 0.15 + Math.random() * 0.25,
          pulseSpeed: 0.3 + Math.random() * 0.8,
          pulsePhase: Math.random() * Math.PI * 2,
        })
      }
      return particles
    }

    let resizePending = false
    function resize() {
      const parent = canvas!.parentElement
      if (!parent) return
      const newW = parent.clientWidth
      const newH = parent.clientHeight
      // Skip if size hasn't actually changed (avoids canvas clear flash)
      if (newW === s.w && newH === s.h && s.particles.length > 0) return
      const oldW = s.w
      const oldH = s.h
      s.w = newW
      s.h = newH
      canvas!.style.width = s.w + 'px'
      canvas!.style.height = s.h + 'px'
      canvas!.width = s.w * s.dpr
      canvas!.height = s.h * s.dpr
      ctx!.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
      // On first call or if no particles, spawn fresh
      if (!oldW || !oldH || s.particles.length === 0) {
        s.particles = spawnParticles(s.w, s.h)
        s.links = []
      } else {
        // Scale existing particle positions proportionally
        const sx = s.w / oldW
        const sy = s.h / oldH
        for (const p of s.particles) {
          p.x *= sx
          p.y *= sy
        }
      }
      // Immediately draw a frame so there's no flash
      resizePending = true
    }

    function draw() {
      const { w, h, mouse, particles, links } = s
      const dt = 0.016
      s.time += dt
      s.linkTimer += dt
      s.wavePhase += dt * 0.3

      // ─── Layer 0: Deep gradient background ───────────────────────
      const bgGrad = ctx!.createLinearGradient(0, 0, w * 0.3, h)
      bgGrad.addColorStop(0, '#0b1120')   // near black
      bgGrad.addColorStop(0.5, '#0a1628') // deep navy
      bgGrad.addColorStop(1, '#060d18')   // near black
      ctx!.fillStyle = bgGrad
      ctx!.fillRect(0, 0, w, h)

      // ─── Layer 3: Soft gradient wave (barely noticeable) ─────────
      // Two slow-moving radial gradients that drift
      const wave1x = w * 0.4 + Math.sin(s.wavePhase * 0.7) * w * 0.15
      const wave1y = h * 0.35 + Math.cos(s.wavePhase * 0.5) * h * 0.1
      const wg1 = ctx!.createRadialGradient(wave1x, wave1y, 0, wave1x, wave1y, w * 0.4)
      wg1.addColorStop(0, 'rgba(30,60,130,0.04)')
      wg1.addColorStop(0.5, 'rgba(20,45,100,0.02)')
      wg1.addColorStop(1, 'rgba(10,20,50,0)')
      ctx!.fillStyle = wg1
      ctx!.fillRect(0, 0, w, h)

      const wave2x = w * 0.65 + Math.cos(s.wavePhase * 0.4) * w * 0.12
      const wave2y = h * 0.6 + Math.sin(s.wavePhase * 0.6) * h * 0.08
      const wg2 = ctx!.createRadialGradient(wave2x, wave2y, 0, wave2x, wave2y, w * 0.35)
      wg2.addColorStop(0, 'rgba(50,80,160,0.025)')
      wg2.addColorStop(0.6, 'rgba(30,50,120,0.01)')
      wg2.addColorStop(1, 'rgba(10,20,60,0)')
      ctx!.fillStyle = wg2
      ctx!.fillRect(0, 0, w, h)

      // ─── Layer 2: Neural connections (very subtle, more active when streaming) ───
      // Spawn new links — faster and more during streaming
      const linkInterval = streamingRef.current ? 0.25 : 0.6
      const maxLinks = streamingRef.current ? 10 : 5
      if (s.linkTimer > linkInterval && links.length < maxLinks && particles.length > 3) {
        s.linkTimer = 0
        const a = Math.floor(Math.random() * particles.length)
        // Find nearby particle
        let bestB = -1
        let bestDist = Infinity
        for (let i = 0; i < particles.length; i++) {
          if (i === a) continue
          const dist = Math.hypot(particles[i].x - particles[a].x, particles[i].y - particles[a].y)
          if (dist > 40 && dist < 180 && dist < bestDist) {
            bestDist = dist
            bestB = i
          }
        }
        if (bestB >= 0) {
          links.push({ a, b: bestB, age: 0, maxLife: 3 + Math.random() * 4, particlePos: 0 })
        }
      }

      // Draw & update links
      for (let i = links.length - 1; i >= 0; i--) {
        const link = links[i]
        link.age += dt
        link.particlePos = (link.particlePos + dt * 0.4) % 1

        if (link.age >= link.maxLife) {
          links.splice(i, 1)
          continue
        }

        const pa = particles[link.a]
        const pb = particles[link.b]
        if (!pa || !pb) { links.splice(i, 1); continue }

        // Fade: sin curve
        const life = Math.sin((link.age / link.maxLife) * Math.PI)
        const lineAlpha = life * 0.12

        // Connection line
        ctx!.beginPath()
        ctx!.moveTo(pa.x, pa.y)
        ctx!.lineTo(pb.x, pb.y)
        ctx!.strokeStyle = `rgba(80,140,220,${lineAlpha.toFixed(4)})`
        ctx!.lineWidth = 0.6
        ctx!.stroke()

        // Traveling light dot
        const tx = pa.x + (pb.x - pa.x) * link.particlePos
        const ty = pa.y + (pb.y - pa.y) * link.particlePos
        const dotAlpha = life * 0.4
        ctx!.beginPath()
        ctx!.arc(tx, ty, 1.5, 0, 6.283)
        ctx!.fillStyle = `rgba(120,180,255,${dotAlpha.toFixed(4)})`
        ctx!.fill()

        // Tiny glow on traveling dot
        const tGrad = ctx!.createRadialGradient(tx, ty, 0, tx, ty, 6)
        tGrad.addColorStop(0, `rgba(100,160,255,${(dotAlpha * 0.25).toFixed(4)})`)
        tGrad.addColorStop(1, 'rgba(100,160,255,0)')
        ctx!.fillStyle = tGrad
        ctx!.fillRect(tx - 6, ty - 6, 12, 12)

        // Brighten endpoints
        pa.alpha = Math.min(0.6, pa.alpha + life * 0.01)
        pb.alpha = Math.min(0.6, pb.alpha + life * 0.01)
      }

      // ─── Layer 1: Glowing particles (slow drift) ────────────────
      for (const p of particles) {
        // Drift
        p.x += p.vx
        p.y += p.vy

        // Wrap around edges
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        // Pulsing glow
        const pulse = Math.sin(s.time * p.pulseSpeed + p.pulsePhase) * 0.5 + 0.5
        const alpha = p.alpha * (0.6 + pulse * 0.4)

        // Mouse interaction: particles near cursor get brighter and slightly attracted
        let mouseBoost = 0
        if (mouse.active) {
          const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y)
          if (dist < 120) {
            mouseBoost = (1 - dist / 120) * 0.5
            // Gentle attraction
            p.vx += (mouse.x - p.x) * 0.00003
            p.vy += (mouse.y - p.y) * 0.00003
          }
        }

        // Streaming boost: subtle brightness increase when AI is responding
        const streamBoost = streamingRef.current ? Math.sin(s.time * 2) * 0.08 + 0.1 : 0
        const totalAlpha = Math.min(0.8, alpha + mouseBoost + streamBoost)

        // Outer glow
        const glowSize = p.size * (3 + pulse * 2)
        const gGrad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
        gGrad.addColorStop(0, `rgba(80,160,255,${(totalAlpha * 0.15).toFixed(4)})`)
        gGrad.addColorStop(0.5, `rgba(60,120,220,${(totalAlpha * 0.05).toFixed(4)})`)
        gGrad.addColorStop(1, 'rgba(40,80,180,0)')
        ctx!.fillStyle = gGrad
        ctx!.fillRect(p.x - glowSize, p.y - glowSize, glowSize * 2, glowSize * 2)

        // Core dot
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size * (0.8 + pulse * 0.2), 0, 6.283)
        ctx!.fillStyle = `rgba(140,200,255,${totalAlpha.toFixed(4)})`
        ctx!.fill()
      }

      // ─── Mouse: constellation web around cursor ──────────────────
      if (mouse.active) {
        const nearIndices: number[] = []
        for (let i = 0; i < particles.length; i++) {
          if (Math.hypot(particles[i].x - mouse.x, particles[i].y - mouse.y) < 100) {
            nearIndices.push(i)
          }
        }
        // Lines from cursor to nearby particles
        for (const idx of nearIndices) {
          const p = particles[idx]
          const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y)
          const strength = 1 - dist / 100
          ctx!.beginPath()
          ctx!.moveTo(mouse.x, mouse.y)
          ctx!.lineTo(p.x, p.y)
          ctx!.strokeStyle = `rgba(100,180,255,${(strength * 0.2).toFixed(4)})`
          ctx!.lineWidth = strength * 0.8
          ctx!.stroke()
        }
        // Connect near particles to each other
        for (let i = 0; i < nearIndices.length; i++) {
          for (let j = i + 1; j < nearIndices.length; j++) {
            const pa = particles[nearIndices[i]]
            const pb = particles[nearIndices[j]]
            const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y)
            if (dist < 80) {
              ctx!.beginPath()
              ctx!.moveTo(pa.x, pa.y)
              ctx!.lineTo(pb.x, pb.y)
              ctx!.strokeStyle = `rgba(80,150,240,${((1 - dist / 80) * 0.08).toFixed(4)})`
              ctx!.lineWidth = 0.4
              ctx!.stroke()
            }
          }
        }

        // Soft cursor glow
        const cGrad = ctx!.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80)
        cGrad.addColorStop(0, 'rgba(60,130,255,0.06)')
        cGrad.addColorStop(0.5, 'rgba(50,100,220,0.02)')
        cGrad.addColorStop(1, 'rgba(40,80,180,0)')
        ctx!.fillStyle = cGrad
        ctx!.fillRect(mouse.x - 80, mouse.y - 80, 160, 160)
      }

      s.raf = requestAnimationFrame(draw)
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      s.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true }
    }
    function onLeave() { s.mouse.active = false }

    resize()
    window.addEventListener('resize', resize)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    // Watch for parent size changes (e.g. sidebar collapse) — debounced
    let resizeTimeout: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(resize, 50)
    })
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    s.raf = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      observer.disconnect()
      clearTimeout(resizeTimeout)
      cancelAnimationFrame(s.raf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto' }}
    />
  )
}
