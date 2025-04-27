// interactive_rectangles.ts

import { randomUUID } from "crypto";

interface Point {
  x: number;
  y: number;
}

function point_to_tup(p: Point): [number, number] {
  return [p.x, p.y];
}

export interface RectEntry { id: string; left: string; right: string }
export interface RectData {
  id: string
  title: string;
  entries: RectEntry[];
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

interface Endpoint {
  rectId: string;
  entryId?: string;
}

// Connections between rectangles or individual entries
interface Connection {
  id: string;
  sideA: Endpoint;
  sideB: Endpoint;
}

// A draggable/resizable rectangle with text data
class Rectangle {
  static edgeThreshold = 6;
  x: number;
  y: number;
  width: number;
  height: number;
  data: RectData;

  constructor(
    data: RectData,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.data = data;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get id(){
    return this.data.id
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
  minWidth: 50, // Minimum practical width
};

// Map HitPart to CSS cursor styles
const CURSOR_MAP: Record<HitPart, string> = {
  inside: "move",
  left: "ew-resize",
  right: "ew-resize",
  top: "ns-resize",
  bottom: "ns-resize",
  "top-left": "nwse-resize",
  "top-right": "nesw-resize",
  "bottom-left": "nesw-resize",
  "bottom-right": "nwse-resize",
};

// The main chart managing multiple rectangles and interactions
class Chart {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rectangles = new Map<string, Rectangle>();
  transform: Transform = { scale: 1, translateX: 0, translateY: 0 };
  pointers = new Map<number, Point>();
  connections = new Map<string, Connection>();
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
    // Initial cursor update
    this.updateCursor({ x: -1, y: -1 } as Point); // Use dummy point outside canvas initially
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

  addRectangle(data: RectData) {
    // place them randomly in world space
    const w = 200;
    const h = 120;
    const x = Math.random() * (this.canvas.width / this.transform.scale - w);
    const y = Math.random() * (this.canvas.height / this.transform.scale - h);
    const rect = new Rectangle({ ...data,  }, x, y, w, h);
    this.rectangles.set(rect.id, rect);
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

  // Connection management methods

  addConnection(
    sideA: { rectId: string; entryId?: string },
    sideB: { rectId: string; entryId?: string },
  ): string {
    const id = crypto.randomUUID();
    this.connections.set(id, { id, sideA, sideB });
    return id;
  }

  removeConnection(id: string): boolean {
    return this.connections.delete(id);
  }

  getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  getConnectionsForRect(rectId: string): Connection[] {
    return this.getConnections().filter(
      (c) => c.sideA.rectId === rectId || c.sideB.rectId === rectId,
    );
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
    this.drawConnections();
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
      ctx.fillText(e.left, r.x + pad, y);
      // right
      ctx.textAlign = "right";
      ctx.fillText(e.right, r.x + r.width - pad, y);
    });
  }

  // Draw all connections as UE4-style bezier curves
  private drawConnections(): void {
    const ctx = this.ctx;
    const scale = this.transform.scale;
    ctx.save();
    ctx.strokeStyle = "#0066ff";
    ctx.lineWidth = 2 / scale;
    for (const conn of this.getConnections()) {
      // choose endpoint pairing with minimal horizontal distance
      const a1 = this.getEndpointPosition(conn.sideA, true);
      const b1 = this.getEndpointPosition(conn.sideB, false);
      const dx1 = Math.abs(a1.x - b1.x);
      const a2 = this.getEndpointPosition(conn.sideA, false);
      const b2 = this.getEndpointPosition(conn.sideB, true);
      const dx2 = Math.abs(a2.x - b2.x);
      const fromPos = dx1 <= dx2 ? a1 : a2;
      const toPos = dx1 <= dx2 ? b1 : b2;
      const cpX = fromPos.x + (toPos.x - fromPos.x) / 2;
      const cp1Y = fromPos.y;
      const cp2Y = toPos.y;
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.bezierCurveTo(cpX, cp1Y, cpX, cp2Y, toPos.x, toPos.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private getEndpointPosition(ep: Endpoint, isFrom: boolean): Point {
    const rect = this.rectangles.get(ep.rectId);
    if (!rect) return { x: 0, y: 0 };
    const r = rect;
    const scale = this.transform.scale;
    const style = RECT_STYLE;
    const pad = style.padding / scale;
    const titleFontSize = style.titleFontSize / scale;
    const titleLineHeight = titleFontSize * 1.2;
    const entryLineHeight = style.lineHeight / scale;
    const titleY = r.y + pad;
    if (ep.entryId) {
      const idx = r.data.entries.findIndex((e) => e.id === ep.entryId);
      if (idx >= 0) {
        const y =
          titleY +
          titleLineHeight +
          idx * entryLineHeight +
          entryLineHeight / 2;
        const x = isFrom ? r.x + r.width - pad : r.x + pad;
        return { x, y };
      }
    }
    // fallback to center
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  // Calculate the minimum height needed for a rectangle's content
  calculateMinimumHeight(r: Rectangle, scale: number): number {
    const style = RECT_STYLE;
    const titleFontSize = style.titleFontSize / scale;
    const titleLineHeight = titleFontSize * 1.2; // Approximate line height
    const entryLineHeight = style.lineHeight / scale;
    const pad = style.padding / scale;

    const contentHeight =
      titleLineHeight + r.data.entries.length * entryLineHeight;
    return contentHeight + pad * 2; // Add top and bottom padding
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

  // Update canvas cursor based on what's under the pointer
  private updateCursor(screenPoint: Point): void {
    // Don't change cursor during pinch or pan
    if (this.pinch || this.panning) return;

    // If resizing/dragging, cursor is already set, keep it
    if (this.resizingRect || this.draggingRect) return;

    const worldPoint = this.screenToWorld(screenPoint.x, screenPoint.y);
    const hit = this.hitTest(worldPoint.x, worldPoint.y);

    if (hit) {
      this.canvas.style.cursor = CURSOR_MAP[hit.part];
    } else {
      this.canvas.style.cursor = "default"; // Or 'grab' if panning is possible
    }
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
        this.canvas.style.cursor = "move"; // Or 'grabbing'
      } else {
        this.resizingRect = {
          rect,
          part,
          start: sp,
          // Set cursor based on the resize part
          init: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        };
        this.canvas.style.cursor = CURSOR_MAP[part]; // Set resize cursor immediately
      }
    } else {
      // start pan
      this.panning = { start: sp, initTrans: { ...this.transform } };
      this.canvas.style.cursor = "grabbing";
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    const sp: Point = { x: e.clientX, y: e.clientY };
    const currentPointerPos = { x: e.clientX, y: e.clientY };
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, currentPointerPos);
    } else {
      // If pointer isn't tracked (e.g., mouse move without button down), update cursor
      this.updateCursor(currentPointerPos);
      return; // Don't process move if not interacting
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
      const scale = this.transform.scale;
      const dx = (sp.x - start.x) / scale;
      const dy = (sp.y - start.y) / scale;
      let newX = rect.x,
        newY = rect.y,
        newW = rect.width,
        newH = rect.height;

      // Calculate proposed dimensions
      if (part.includes("left")) {
        newX = init.x + dx;
        newW = init.w - dx;
      }
      if (part.includes("right")) {
        newW = init.w + dx;
      }
      if (part.includes("top")) {
        newY = init.y + dy;
        newH = init.h - dy;
      }
      if (part.includes("bottom")) {
        newH = init.h + dy;
      }

      // Enforce minimum dimensions
      const minHeight = this.calculateMinimumHeight(rect, scale);
      const minWidth = RECT_STYLE.minWidth / scale; // Use scaled min width

      if (newW < minWidth) {
        if (part.includes("left")) {
          newX = rect.x + rect.width - minWidth; // Adjust x to maintain right edge
        }
        newW = minWidth;
      }
      if (newH < minHeight) {
        if (part.includes("top")) {
          newY = rect.y + rect.height - minHeight; // Adjust y to maintain bottom edge
        }
        newH = minHeight;
      }

      // Apply constrained dimensions
      rect.x = newX;
      rect.y = newY;
      rect.width = newW;
      rect.height = newH;

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
      // Update cursor based on final position
      this.updateCursor({ x: e.clientX, y: e.clientY });
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
    const entries: { id: string; left: string; right: string }[] = [];
    const n = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) {
      entries.push({
        id: crypto.randomUUID(),
        left: randomHex(6 + Math.floor(Math.random() * 11)),
        right: randomHex(6 + Math.floor(Math.random() * 11)),
      });
    }
    ds.push({ title, entries,id: randomUUID() });
  }
  return ds;
}

function main(): void {
  clearHTML();
  const canvas = initializeCanvas();
  const chart = new Chart(canvas);
  const data = generateDummyData(5);
  data.forEach(x=>chart.addRectangle(x))
  const ids = data.map((d) => d.id);

  // Dummy connection data between first and second rectangle entries
  if (ids.length >= 2) {
    const fromRect = chart.rectangles.get(ids[0]);
    const toRect = chart.rectangles.get(ids[1]);
    if (fromRect && toRect) {
      const fromEntryId = fromRect.data.entries[0]?.id;
      const toEntryId = toRect.data.entries[toRect.data.entries.length - 1]?.id;
      if (fromEntryId && toEntryId) {
        chart.addConnection(
          { rectId: ids[0], entryId: fromEntryId },
          { rectId: ids[1], entryId: toEntryId },
        );
      }
    }
  }

  chart.draw();

  // expose methods globally if you like:
  (window as any).chart = chart;
}

window.addEventListener("DOMContentLoaded", main);
