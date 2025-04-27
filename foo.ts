// interactive_rectangles.ts

interface Point {
  x: number;
  y: number;
}

function point_to_tup(p: Point): [number, number] {
  return [p.x, p.y];
}

interface RectData {
  title: string;
  entries: [string, string][];
}

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

type HitPart =
  | "inside"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

// A draggable/resizable rectangle with text data
class Rectangle {
  static edgeThreshold = 6;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: RectData;

  constructor(
    id: string,
    data: RectData,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.id = id;
    this.data = data;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  // Determine where a point lies relative to this rect
  getHitPart(px: number, py: number): HitPart | null {
    const t = Rectangle.edgeThreshold;
    const leftDist = Math.abs(px - this.x);
    const rightDist = Math.abs(px - (this.x + this.width));
    const topDist = Math.abs(py - this.y);
    const bottomDist = Math.abs(py - (this.y + this.height));
    const inX = px > this.x - t && px < this.x + this.width + t;
    const inY = py > this.y - t && py < this.y + this.height + t;

    const nearLeft = leftDist < t && inY;
    const nearRight = rightDist < t && inY;
    const nearTop = topDist < t && inX;
    const nearBottom = bottomDist < t && inX;

    // corners
    if (nearLeft && nearTop) return "top-left";
    if (nearRight && nearTop) return "top-right";
    if (nearLeft && nearBottom) return "bottom-left";
    if (nearRight && nearBottom) return "bottom-right";
    if (nearLeft) return "left";
    if (nearRight) return "right";
    if (nearTop) return "top";
    if (nearBottom) return "bottom";
    if (inX && inY) return "inside";
    return null;
  }
}

// Style constants for rectangles
const RECT_STYLE = {
  padding: 8,
  lineHeight: 18,
  titleFontSize: 16, // Customizable title font size
  entryFontSize: 14,
  fontFamily: "sans-serif",
  fillStyle: "#fff",
  strokeStyle: "#000",
  textColor: "#000",
};

// The main chart managing multiple rectangles and interactions
class Chart {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rectangles = new Map<string, Rectangle>();
  transform: Transform = { scale: 1, translateX: 0, translateY: 0 };
  pointers = new Map<number, Point>();
  draggingRect?: { rect: Rectangle; start: Point; initPos: Point };
  resizingRect?: {
    rect: Rectangle;
    part: HitPart;
    start: Point;
    init: { x: number; y: number; w: number; h: number };
  };
  panning?: { start: Point; initTrans: Transform };
  pinch?: { startDist: number; startScale: number; mid: Point };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get 2D context");
    this.ctx = ctx;
    this.initEvents();
  }

  // Install pointer and wheel events
  initEvents(): void {
    this.canvas.addEventListener("pointerdown", (e) =>
      this.handlePointerDown(e),
    );
    this.canvas.addEventListener("pointermove", (e) =>
      this.handlePointerMove(e),
    );
    this.canvas.addEventListener("pointerup", (e) => this.handlePointerUp(e));
    this.canvas.addEventListener("pointercancel", (e) =>
      this.handlePointerUp(e),
    );
    this.canvas.addEventListener("wheel", (e) => this.handleWheel(e), {
      passive: false,
    });
  }

  addRectangle(data: RectData): string {
    const id = crypto.randomUUID();
    // place them randomly in world space
    const w = 200;
    const h = 120;
    const x = Math.random() * (this.canvas.width / this.transform.scale - w);
    const y = Math.random() * (this.canvas.height / this.transform.scale - h);
    const rect = new Rectangle(id, data, x, y, w, h);
    this.rectangles.set(id, rect);
    return id;
  }

  removeRectangle(id: string): boolean {
    return this.rectangles.delete(id);
  }

  updateRectangle(id: string, data: RectData): boolean {
    const rect = this.rectangles.get(id);
    if (!rect) return false;
    rect.data = data;
    return true;
  }

  // Clear & redraw everything
  draw(): void {
    const { width, height } = this.canvas;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    // apply pan & zoom
    this.ctx.setTransform(
      this.transform.scale,
      0,
      0,
      this.transform.scale,
      this.transform.translateX,
      this.transform.translateY,
    );
    for (const rect of this.rectangles.values()) {
      this.drawRectangle(rect);
    }
  }

  public drawRectangle(r: Rectangle): void {
    const ctx = this.ctx;
    const scale = this.transform.scale;
    const style = RECT_STYLE;

    // Calculate scaled metrics
    const pad = style.padding / scale;
    const titleFontSize = style.titleFontSize / scale;
    const entryFontSize = style.entryFontSize / scale;
    const titleLineHeight = titleFontSize * 1.2; // Approximate line height based on font size
    const entryLineHeight = style.lineHeight / scale; // Use fixed line height for entries for now

    // box
    ctx.fillStyle = style.fillStyle;
    ctx.strokeStyle = style.strokeStyle;
    ctx.lineWidth = 1 / scale;
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeRect(r.x, r.y, r.width, r.height);

    // text setup
    ctx.fillStyle = style.textColor;
    ctx.textBaseline = "top";

    // title centered
    ctx.font = `${titleFontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    const titleX = r.x + r.width / 2;
    const titleY = r.y + pad;
    ctx.fillText(r.data.title, titleX, titleY);

    // entries
    ctx.font = `${entryFontSize}px ${style.fontFamily}`;
    const entryStartY = titleY + titleLineHeight; // Start entries below the title line
    r.data.entries.forEach((e, i) => {
      const y = entryStartY + i * entryLineHeight;
      // left
      ctx.textAlign = "left";
      ctx.fillText(e[0], r.x + pad, y);
      // right
      ctx.textAlign = "right";
      ctx.fillText(e[1], r.x + r.width - pad, y);
    });
  }

  hitTest(x: number, y: number): { rect: Rectangle; part: HitPart } | null {
    for (const rect of Array.from(this.rectangles.values()).reverse()) {
      const part = rect.getHitPart(x, y);
      if (part) return { rect, part };
    }
    return null;
  }

  screenToWorld(x: number, y: number): Point {
    return {
      x: (x - this.transform.translateX) / this.transform.scale,
      y: (y - this.transform.translateY) / this.transform.scale,
    };
  }

  // ------ Event Handlers ------

  private handlePointerDown(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    const sp: Point = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, sp);
    if (this.pointers.size === 2) {
      // pinch start
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      this.pinch = {
        startDist: dist,
        startScale: this.transform.scale,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      };
      return;
    }

    // single-pointer: pan or rect

    const hit = this.hitTest(...point_to_tup(this.screenToWorld(sp.x, sp.y)));
    if (hit) {
      const { rect, part } = hit;
      if (part === "inside") {
        this.draggingRect = {
          rect,
          start: sp,
          initPos: { x: rect.x, y: rect.y },
        };
      } else {
        this.resizingRect = {
          rect,
          part,
          start: sp,
          init: {
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
          },
        };
      }
    } else {
      // start pan
      this.panning = {
        start: sp,
        initTrans: { ...this.transform },
      };
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    const sp: Point = { x: e.clientX, y: e.clientY };
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, sp);
    }
    // pinch?
    if (this.pinch && this.pointers.size === 2) {
      const pts = Array.from(this.pointers.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      const scale = (dist / this.pinch.startDist) * this.pinch.startScale;
      // zoom about mid
      const w0 = this.screenToWorld(this.pinch.mid.x, this.pinch.mid.y);
      this.transform.scale = scale;
      this.transform.translateX = this.pinch.mid.x - w0.x * scale;
      this.transform.translateY = this.pinch.mid.y - w0.y * scale;
      this.draw();
      return;
    }

    // resize
    if (this.resizingRect) {
      const { rect, part, start, init } = this.resizingRect;
      const dx = (sp.x - start.x) / this.transform.scale;
      const dy = (sp.y - start.y) / this.transform.scale;
      // adjust edges
      if (part.includes("left")) {
        rect.x = init.x + dx;
        rect.width = init.w - dx;
      }
      if (part.includes("right")) {
        rect.width = init.w + dx;
      }
      if (part.includes("top")) {
        rect.y = init.y + dy;
        rect.height = init.h - dy;
      }
      if (part.includes("bottom")) {
        rect.height = init.h + dy;
      }
      this.draw();
      return;
    }

    // drag rect
    if (this.draggingRect) {
      const { rect, start, initPos } = this.draggingRect;
      const dx = (sp.x - start.x) / this.transform.scale;
      const dy = (sp.y - start.y) / this.transform.scale;
      rect.x = initPos.x + dx;
      rect.y = initPos.y + dy;
      this.draw();
      return;
    }

    // pan
    if (this.panning) {
      const { start, initTrans } = this.panning;
      this.transform.translateX = initTrans.translateX + (sp.x - start.x);
      this.transform.translateY = initTrans.translateY + (sp.y - start.y);
      this.draw();
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    this.canvas.releasePointerCapture(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) {
      this.pinch = undefined;
    }
    if (this.pointers.size === 0) {
      this.draggingRect = undefined;
      this.resizingRect = undefined;
      this.panning = undefined;
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = this.transform.scale * (1 + delta);
    const wx = (e.clientX - this.transform.translateX) / this.transform.scale;
    const wy = (e.clientY - this.transform.translateY) / this.transform.scale;
    this.transform.scale = newScale;
    this.transform.translateX = e.clientX - wx * newScale;
    this.transform.translateY = e.clientY - wy * newScale;
    this.draw();
  }
}

// Top-level helpers

function clearHTML(): void {
  document.body.innerHTML = "";
}

function initializeCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.style.position = "absolute";
  c.style.top = "0";
  c.style.left = "0";
  document.body.appendChild(c);
  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();
  return c;
}

function randomHex(len: number): string {
  let s = "";
  const hex = "0123456789abcdef";
  for (let i = 0; i < len; i++) {
    s += hex[Math.floor(Math.random() * 16)];
  }
  return s;
}

function generateDummyData(count: number): RectData[] {
  const ds: RectData[] = [];
  for (let i = 0; i < count; i++) {
    const title = randomHex(6 + Math.floor(Math.random() * 11));
    const entries: [string, string][] = [];
    const n = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) {
      entries.push([
        randomHex(6 + Math.floor(Math.random() * 11)),
        randomHex(6 + Math.floor(Math.random() * 11)),
      ]);
    }
    ds.push({ title, entries });
  }
  return ds;
}

function main(): void {
  clearHTML();
  const canvas = initializeCanvas();
  const chart = new Chart(canvas);
  const data = generateDummyData(5);
  data.forEach((d) => chart.addRectangle(d));
  chart.draw();

  // expose methods globally if you like:
  (window as any).chart = chart;
}

window.addEventListener("DOMContentLoaded", main);
