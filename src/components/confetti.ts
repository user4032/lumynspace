/**
 * Міні-конфеті без залежностей, у стилі GitHub: два «гарпуни» з нижніх кутів
 * святкують угору до центру. fireConfetti() малює ~2.4с і прибирає canvas.
 */
const COLORS = ["#7c5cff", "#2AABEE", "#f59e0b", "#22c55e", "#ec4899", "#ffffff"]

type P = {
  x: number; y: number; vx: number; vy: number
  w: number; h: number; rot: number; vr: number
  color: string; shape: 0 | 1; life: number
}

export function fireConfetti() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

  const canvas = document.createElement("canvas")
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = window.innerWidth
  const H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: `${W}px`, height: `${H}px`,
    pointerEvents: "none", zIndex: "80",
  })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext("2d")
  if (!ctx) { canvas.remove(); return }
  ctx.scale(dpr, dpr)

  const parts: P[] = []
  const burst = (x: number, y: number, dir: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * 0.9
      const v = 11 + Math.random() * 9
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        w: 6 + Math.random() * 5,
        h: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        shape: Math.random() < 0.25 ? 1 : 0,
        life: 1,
      })
    }
  }
  burst(0.08 * W, H + 8, -Math.PI / 2.6, 70)
  burst(0.92 * W, H + 8, -Math.PI + Math.PI / 2.6, 70)

  const t0 = performance.now()
  let raf = 0
  const tick = (t: number) => {
    const dt = t - t0
    ctx.clearRect(0, 0, W, H)
    let alive = false
    for (const p of parts) {
      p.vy += 0.22
      p.vx *= 0.985
      p.vy *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      if (dt > 1500) p.life = Math.max(0, 1 - (dt - 1500) / 900)
      if (p.life <= 0 || p.y > H + 20) continue
      alive = true
      ctx.save()
      ctx.globalAlpha = p.life
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.shape) {
        ctx.beginPath()
        ctx.arc(0, 0, p.h / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // «плющимось» по осі обертання — ефект перевернення листочка
        ctx.scale(1, Math.abs(Math.sin(p.rot * 1.4)) * 0.8 + 0.2)
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      }
      ctx.restore()
    }
    if (alive && dt < 2600) raf = requestAnimationFrame(tick)
    else { cancelAnimationFrame(raf); canvas.remove() }
  }
  raf = requestAnimationFrame(tick)
}
