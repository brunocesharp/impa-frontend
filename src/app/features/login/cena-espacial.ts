import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';

/**
 * Painel decorativo do login: cometa (símbolo da marca), rastros de fogo, órbita, planeta low-poly e estrelas
 * sobre o fundo Espaço. Porte da cena "login" da prancha (docs/impa/direcao-arte/prancha-meio-tom.html).
 * Regras da direção de arte: fogo só no cometa e nos rastros; respiro de 1,5× ao redor do cometa.
 */
@Component({
  selector: 'app-cena-espacial',
  template: `<canvas #tela aria-hidden="true"></canvas>`,
  styles: `
    :host { display: block; position: relative; background: #121318; overflow: hidden; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenaEspacial {
  private readonly tela = viewChild.required<ElementRef<HTMLCanvasElement>>('tela');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      // Sem ResizeObserver (testes em jsdom) não há o que desenhar.
      if (typeof ResizeObserver === 'undefined') return;

      const canvas = this.tela().nativeElement;
      const simbolo = new Image();
      simbolo.src = 'brand/simbolo.png';

      const desenhar = () => desenharCena(canvas, simbolo);
      simbolo.onload = desenhar;

      const observador = new ResizeObserver(desenhar);
      observador.observe(canvas);
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }
}

type Rgb = [number, number, number];
type Respiro = { cx: number; cy: number; r: number };

const TAU = Math.PI * 2;
const EIXO = (-50 * Math.PI) / 180; // eixo do cometa: sobe para a direita (≈ 50°)
const ESPACO = '#121318';
const ESPACO_3: Rgb = [0x26, 0x27, 0x2f];
const NEVOA: Rgb = [0xd4, 0xd6, 0xe2];
const NEVOA_CSS = '#D4D6E2';
const CHAMA: Rgb = [0xef, 0x6a, 0x22];
const FOGO: Rgb[] = [
  [0xf9, 0xa3, 0x1a], // Faísca
  [0xef, 0x6a, 0x22], // Chama
  [0xe8, 0x1d, 0x23], // Impacto
  [0xb9, 0x23, 0x15], // Brasa
];

function rampa(cores: Rgb[], t: number): string {
  t = Math.max(0, Math.min(1, t));
  const n = cores.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - i;
  return `rgb(${cores[i].map((v, k) => Math.round(v + (cores[i + 1][k] - v) * f)).join(',')})`;
}

/** Pseudoaleatório com semente: a cena é sempre a mesma. */
function aleatorio(semente: number): () => number {
  return () => (semente = (semente * 16807) % 2147483647) / 2147483647;
}

function desenharCena(canvas: HTMLCanvasElement, simbolo: HTMLImageElement): void {
  const caixa = canvas.getBoundingClientRect();
  const w = caixa.width;
  const h = caixa.height;
  if (w < 2 || h < 2) return;

  const escala = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * escala);
  canvas.height = Math.round(h * escala);
  const x = canvas.getContext('2d');
  if (!x) return;
  x.setTransform(escala, 0, 0, escala, 0, 0);

  x.fillStyle = ESPACO;
  x.fillRect(0, 0, w, h);

  const menor = Math.min(w, h);
  const respiro: Respiro = { cx: w * 0.6, cy: h * 0.5, r: menor * 0.17 };

  orbita(x, w * 0.5, h * 0.55, w * 0.55, h * 0.18, -0.3, 0.25, respiro);
  planeta(x, w * 0.18, h * 0.8, menor * 0.07, 91, [0.8, -0.6]);
  estrelas(x, w, h, 34, 27, respiro);
  // Proporção da prancha (0,5) num painel 16:10; no painel de altura inteira, 0,42 mantém os rastros dentro.
  rastros(x, respiro.cx + respiro.r * 0.4, respiro.cy - respiro.r * 0.5, 4, menor * 0.42, 29);
  cometa(x, simbolo, respiro.cx, respiro.cy, menor * 0.42);
}

function cometa(x: CanvasRenderingContext2D, simbolo: HTMLImageElement, cx: number, cy: number, tamanho: number): void {
  if (!simbolo.naturalWidth) return;
  const altura = (tamanho * simbolo.naturalHeight) / simbolo.naturalWidth;
  x.drawImage(simbolo, cx - tamanho * 0.25, cy - altura * 0.78, tamanho, altura);
}

function rastros(x: CanvasRenderingContext2D, ox: number, oy: number, n: number, comprimento: number, semente: number): void {
  const r = aleatorio(semente);
  const ux = Math.cos(EIXO);
  const uy = Math.sin(EIXO);
  const vx = -uy;
  const vy = ux;
  x.lineCap = 'round';

  for (let i = 0; i < n; i++) {
    const desvio = (r() - 0.5) * comprimento * 0.7;
    const inicio = r() * comprimento * 0.25;
    const tamanho = comprimento * (0.35 + r() * 0.65);
    const sx = ox + vx * desvio + ux * inicio;
    const sy = oy + vy * desvio + uy * inicio;
    const ex = sx + ux * tamanho;
    const ey = sy + uy * tamanho;

    const degrade = x.createLinearGradient(sx, sy, ex, ey);
    degrade.addColorStop(0, rampa(FOGO, 0.05 + r() * 0.2));
    degrade.addColorStop(1, rampa(FOGO, 0.85 + r() * 0.15));
    x.strokeStyle = degrade;
    x.lineWidth = 1.5 + r() * (comprimento / 45);
    x.beginPath();
    x.moveTo(sx, sy);
    x.lineTo(ex, ey);
    x.stroke();
  }
}

function estrela(x: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  x.beginPath();
  x.moveTo(cx, cy - s);
  x.quadraticCurveTo(cx, cy, cx + s * 0.7, cy);
  x.quadraticCurveTo(cx, cy, cx, cy + s);
  x.quadraticCurveTo(cx, cy, cx - s * 0.7, cy);
  x.quadraticCurveTo(cx, cy, cx, cy - s);
  x.fill();
}

function estrelas(x: CanvasRenderingContext2D, w: number, h: number, n: number, semente: number, respiro: Respiro): void {
  const r = aleatorio(semente);
  x.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const px = r() * w;
    const py = r() * h;
    if (Math.hypot(px - respiro.cx, py - respiro.cy) < respiro.r * 1.5 + 10) continue;
    const grande = r() < 0.1;
    x.globalAlpha = 0.45 + r() * 0.55;
    if (grande) {
      estrela(x, px, py, 5 + r() * 5);
    } else {
      x.beginPath();
      x.arc(px, py, 0.6 + r() * 0.9, 0, TAU);
      x.fill();
    }
  }
  x.globalAlpha = 1;
}

function orbita(
  x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rotacao: number, alfa: number, respiro: Respiro,
): void {
  x.save();
  x.strokeStyle = NEVOA_CSS;
  x.globalAlpha = alfa;
  x.lineWidth = 1;
  x.beginPath();
  let caneta = false;
  for (let i = 0; i <= 140; i++) {
    const t = (i / 140) * TAU;
    const px = cx + Math.cos(t) * rx * Math.cos(rotacao) - Math.sin(t) * ry * Math.sin(rotacao);
    const py = cy + Math.cos(t) * rx * Math.sin(rotacao) + Math.sin(t) * ry * Math.cos(rotacao);
    if (Math.hypot(px - respiro.cx, py - respiro.cy) < respiro.r * 1.5) {
      caneta = false; // a órbita se interrompe na área de respiro do cometa
      continue;
    }
    if (caneta) x.lineTo(px, py);
    else {
      x.moveTo(px, py);
      caneta = true;
    }
  }
  x.stroke();
  x.restore();
}

function planeta(x: CanvasRenderingContext2D, cx: number, cy: number, raio: number, semente: number, luz: [number, number]): void {
  const r = aleatorio(semente);
  const lados = 10;
  const pontos: [number, number][] = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * TAU + r() * 0.25;
    pontos.push([cx + Math.cos(a) * raio * (0.93 + r() * 0.08), cy + Math.sin(a) * raio * (0.93 + r() * 0.08)]);
  }
  const centro: [number, number] = [cx + (r() - 0.5) * raio * 0.5, cy + (r() - 0.5) * raio * 0.5];

  for (let i = 0; i < lados; i++) {
    const p1 = pontos[i];
    const p2 = pontos[(i + 1) % lados];
    const mx = (p1[0] + p2[0] + centro[0]) / 3 - cx;
    const my = (p1[1] + p2[1] + centro[1]) / 3 - cy;
    const t = Math.max(0, (-mx * luz[0] - my * luz[1]) / raio + 0.25);

    let cor = ESPACO_3.map((v, k) => Math.round(v + (NEVOA[k] - v) * Math.min(0.6, t * 0.5)));
    // Só a borda voltada para o cometa recebe Chama.
    if (t > 0.8) cor = cor.map((v, k) => Math.round(v + (CHAMA[k] - v) * 0.65));
    x.fillStyle = `rgb(${cor.join(',')})`;
    x.beginPath();
    x.moveTo(p1[0], p1[1]);
    x.lineTo(p2[0], p2[1]);
    x.lineTo(centro[0], centro[1]);
    x.closePath();
    x.fill();
  }
}
