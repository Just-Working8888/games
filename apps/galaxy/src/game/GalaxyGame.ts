// Suika-механика на matter.js с собственным рендером (свечение, частицы, комбо, danger-линия).
import Matter from 'matter-js';
import { MAX_TIER, TIERS, randomSpawnTier } from './tiers';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Float {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
}
const DROP_Y = 54;
const DEADLINE_Y = 96;
const DROP_COOLDOWN = 320;
const OVER_MS = 1200;
const COMBO_WINDOW = 900;
// draw scale per tier: how many radii to use as half-size when drawing the image
const IMG_SCALES = [1.5, 2.2, 2.5, 1.5, 1.5, 1.9, 1.7, 1.7, 2.2, 2.5, 1.8];

export class GalaxyGame {
  private ctx: CanvasRenderingContext2D;
  private engine: Matter.Engine;
  private world: Matter.World;
  private width: number;
  private height: number;
  private raf = 0;
  private lastTs = 0;

  private current: number;
  private next: number;
  private dropX: number;
  private lastDrop = 0;
  private merged = new Set<number>();
  private overTimer = 0;
  private danger = false;
  private running = true;

  private particles: Particle[] = [];
  private floats: Float[] = [];
  private images: HTMLImageElement[] = [];

  private combo = 0;
  private lastMergeTs = -9999;

  score = 0;
  onScore?: (score: number, combo: number) => void;
  onMerge?: (tier: number) => void;
  onDrop?: (tier: number) => void;
  onPreview?: (current: number, next: number) => void;
  onGameOver?: (score: number) => void;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.dropX = width / 2;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);

    this.engine = Matter.Engine.create();
    this.engine.gravity.y = 1;
    this.world = this.engine.world;

    const t = 60;
    const wall = (x: number, y: number, w: number, h: number) => {
      const b = Matter.Bodies.rectangle(x, y, w, h, { isStatic: true });
      (b as any).isWall = true;
      return b;
    };
    Matter.Composite.add(this.world, [
      wall(width / 2, height + t / 2, width + t, t),
      wall(-t / 2, height / 2, t, height * 2),
      wall(width + t / 2, height / 2, t, height * 2),
    ]);

    this.loadImages();

    this.current = randomSpawnTier(Math.random);
    this.next = randomSpawnTier(Math.random);

    Matter.Events.on(this.engine, 'collisionStart', this.onCollision);

    this.raf = requestAnimationFrame(this.loop);
  }

  // ── управление ─────────────────────────────────────────────────────────────
  aim(x: number) {
    const r = TIERS[this.current].radius;
    this.dropX = Math.max(r + 4, Math.min(this.width - r - 4, x));
  }

  drop() {
    if (!this.running) return;
    const now = this.engine.timing.timestamp;
    if (now - this.lastDrop < DROP_COOLDOWN) return;
    this.lastDrop = now;
    const tier = this.current;
    Matter.Composite.add(this.world, this.makeBody(this.dropX, DROP_Y, tier));
    this.onDrop?.(tier);
    this.current = this.next;
    this.next = randomSpawnTier(Math.random);
    this.onPreview?.(this.current, this.next);
  }

  emitPreview() {
    this.onPreview?.(this.current, this.next);
  }

  private makeBody(x: number, y: number, tier: number): Matter.Body {
    const body = Matter.Bodies.circle(x, y, TIERS[tier].radius, {
      restitution: 0.12,
      friction: 0.5,
      frictionStatic: 0.6,
    });
    (body as any).tier = tier;
    return body;
  }

  // ── слияние ────────────────────────────────────────────────────────────────
  private onCollision = (evt: Matter.IEventCollision<Matter.Engine>) => {
    const removed: number[] = [];
    for (const pair of evt.pairs) {
      const a = pair.bodyA as any;
      const b = pair.bodyB as any;
      if (a.tier === undefined || b.tier === undefined) continue;
      if (a.tier !== b.tier) continue;
      if (a.tier >= MAX_TIER) continue;
      if (this.merged.has(a.id) || this.merged.has(b.id)) continue;

      this.merged.add(a.id);
      this.merged.add(b.id);
      removed.push(a.id, b.id);
      const nx = (a.position.x + b.position.x) / 2;
      const ny = (a.position.y + b.position.y) / 2;
      const nt = a.tier + 1;

      Matter.Composite.remove(this.world, a);
      Matter.Composite.remove(this.world, b);
      const nb = this.makeBody(nx, ny, nt);
      Matter.Body.setVelocity(nb, { x: 0, y: -2 });
      Matter.Composite.add(this.world, nb);

      // комбо
      const now = this.engine.timing.timestamp;
      this.combo = now - this.lastMergeTs < COMBO_WINDOW ? this.combo + 1 : 1;
      this.lastMergeTs = now;
      const pts = (nt + 1) * 2 * this.combo;
      this.score += pts;

      this.spawnBurst(nx, ny, TIERS[nt].glow);
      this.floats.push({
        x: nx,
        y: ny,
        life: 900,
        max: 900,
        text: this.combo > 1 ? `+${pts} x${this.combo}` : `+${pts}`,
        color: TIERS[nt].glow,
      });
      this.onMerge?.(nt);
      this.onScore?.(this.score, this.combo);
    }
    // чистим Set после обработки пачки пар — иначе он растёт весь забег
    for (const id of removed) this.merged.delete(id);
  };

  /**
   * «Второй шанс»: убираем все тела, чья ВЕРХНЯЯ кромка выше 45% высоты поля
   * (danger меряется по кромке — после чистки гарантирован запас до линии),
   * сбрасываем danger-таймер и продолжаем забег.
   */
  revive() {
    const cutoff = this.height * 0.45;
    for (const body of [...Matter.Composite.allBodies(this.world)]) {
      const tier = (body as any).tier;
      if (tier === undefined || body.position.y - TIERS[tier].radius >= cutoff) continue;
      Matter.Composite.remove(this.world, body);
      this.merged.delete(body.id);
      this.spawnBurst(body.position.x, body.position.y, TIERS[tier].glow);
    }
    this.overTimer = 0;
    this.danger = false;
    this.combo = 0;
    this.lastMergeTs = -9999;
    this.running = true;
  }

  private spawnBurst(x: number, y: number, color: string) {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 500,
        max: 500,
        color,
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  // ── цикл ─────────────────────────────────────────────────────────────────
  private loop = (ts: number) => {
    const dt = this.lastTs ? Math.min(ts - this.lastTs, 32) : 16;
    this.lastTs = ts;

    if (this.running) {
      Matter.Engine.update(this.engine, dt);
      this.updateDanger(dt);
    }
    this.updateFX(dt);
    this.draw(ts);
    this.raf = requestAnimationFrame(this.loop);
  };

  private updateDanger(dt: number) {
    let danger = false;
    for (const body of Matter.Composite.allBodies(this.world)) {
      const tier = (body as any).tier;
      if (tier === undefined) continue;
      if (Math.abs(body.velocity.y) < 0.25 && body.position.y - TIERS[tier].radius < DEADLINE_Y) {
        danger = true;
        break;
      }
    }
    this.danger = danger;
    this.overTimer = danger ? this.overTimer + dt : 0;
    if (this.overTimer > OVER_MS) {
      this.running = false;
      this.onGameOver?.(this.score);
    }
  }

  private updateFX(dt: number) {
    const k = dt / 16;
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += 0.12 * k;
    }
    this.floats = this.floats.filter((f) => (f.life -= dt) > 0);
    for (const f of this.floats) f.y -= 0.6 * k;
  }

  // ── рендер ──────────────────────────────────────────────────────────────
  private draw(ts: number) {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    // danger-линия
    const pulse = this.danger ? 0.5 + 0.5 * Math.sin(ts / 120) : 0.25;
    ctx.strokeStyle = this.danger ? `rgba(255,92,124,${pulse})` : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(0, DEADLINE_Y);
    ctx.lineTo(width, DEADLINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // тела
    for (const body of Matter.Composite.allBodies(this.world)) {
      const tier = (body as any).tier;
      if (tier === undefined) continue;
      this.drawBody(body.position.x, body.position.y, tier, body.angle, 1);
    }

    // превью-призрак того, что дропнется
    if (this.running) {
      ctx.globalAlpha = 0.4;
      this.drawBody(this.dropX, DROP_Y, this.current, 0, 1);
      ctx.globalAlpha = 1;
      // направляющая
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(this.dropX, DROP_Y + TIERS[this.current].radius);
      ctx.lineTo(this.dropX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // частицы
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // всплывающий счёт
    ctx.textAlign = 'center';
    ctx.font = '700 15px -apple-system, sans-serif';
    for (const f of this.floats) {
      ctx.globalAlpha = Math.min(1, f.life / 400);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private loadImages() {
    for (let i = 0; i < TIERS.length; i++) {
      const img = new Image();
      img.src = `/assets/planets/tier-${i}.png`;
      this.images.push(img);
    }
  }

  private imgHalf(tier: number): number {
    return TIERS[tier].radius * IMG_SCALES[tier];
  }

  private drawBody(x: number, y: number, tier: number, angle: number, alpha: number) {
    const { ctx } = this;
    const r = TIERS[tier].radius;
    const half = this.imgHalf(tier);
    const img = this.images[tier];

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.96, 0, Math.PI * 2);
    ctx.clip();

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -half, -half, half * 2, half * 2);
    } else {
      // fallback gradient while image loads
      ctx.shadowColor = TIERS[tier].glow;
      ctx.shadowBlur = 14;
      const grad = ctx.createRadialGradient(-r * 0.32, -r * 0.32, r * 0.1, 0, 0, r);
      grad.addColorStop(0, TIERS[tier].c1);
      grad.addColorStop(1, TIERS[tier].c2);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    Matter.Events.off(this.engine, 'collisionStart', this.onCollision);
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }
}
