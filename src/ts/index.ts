import '../styles/global.scss';
import '../styles/global.css';

type Coordinates = {
  x: number;
  y: number;
}

type Stroke = {
  points: Coordinates[];
  color: string | CanvasGradient | CanvasPattern;
  width: number;
};

enum Mode {
  IDLE = "idle",
  DRAWING = "drawing",
  PENDING = "pending",
  PANNING = "panning",
  ZOOMING = "zooming",
}

const EmptyCoordinates: Coordinates = { x: 0, y: 0 };

class Whiteboard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: Mode = Mode.IDLE;

  // drawing
  private hasMoved: boolean = false;

  // panning
  private panStart: Coordinates = EmptyCoordinates;
  private offset: Coordinates = EmptyCoordinates;
  private lastOffset: Coordinates = EmptyCoordinates;
  private strokes: Stroke[] = [];
  private currentStroke: Stroke | null = null;

  // zooming
  private scale: number = 1;
  private lastScale: number = 1;
  private pinchStartDist: number = 0;
  private pinchStartMid: Coordinates = EmptyCoordinates;
  private pinchStartOffset: Coordinates = EmptyCoordinates;

  // gesture discrimination
  private gestureInitialDist: number = 0;
  private gestureInitialMid: Coordinates = EmptyCoordinates;
  private gestureThreshold: number = 10; // px threshold for discrimination

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.setupCanvas();
    this.setupEventListeners();
  }

  private setupCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.canvas.addEventListener('mousemove', this.draw.bind(this));
    this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }

  // ************* TOUCH EVENTS *************
  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      if (this.mode === Mode.DRAWING) {
        this.cutoffDrawing();
      }
      this.mode = Mode.PENDING;
      this.gestureInitialDist = this.getPinchDistance(e);
      this.gestureInitialMid = this.getAverageCoordinates(e);
    } else if (e.touches.length === 1) {
      this.startDrawing(e);
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (e.touches.length === 2) {
      if (this.mode === Mode.PENDING) {
        // Discriminate between pan and zoom
        const dist = this.getPinchDistance(e);
        const mid = this.getAverageCoordinates(e);
        const distDelta = Math.abs(dist - this.gestureInitialDist);
        const midDelta = Math.hypot(mid.x - this.gestureInitialMid.x, mid.y - this.gestureInitialMid.y);
        if (distDelta > this.gestureThreshold) {
          this.startZooming(e);
        } else if (midDelta > this.gestureThreshold) {
          this.startPanning(e);
        }
      } else if (this.mode === Mode.ZOOMING) {
        this.continueZooming(e);
      } else if (this.mode === Mode.PANNING) {
        this.continuePanning(e);
      }
    } else if (this.mode === Mode.DRAWING && e.touches.length === 1) {
      this.draw(e);
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if ((this.mode === Mode.ZOOMING || this.mode === Mode.PANNING) && e.touches.length < 2) {
      if (this.mode === Mode.ZOOMING) this.stopZooming();
      if (this.mode === Mode.PANNING) this.stopPanning();
    } else if (this.mode === Mode.DRAWING && e.touches.length === 0) {
      this.stopDrawing();
    }
  }

  // ************* ZOOMING *************
  private startZooming(e: TouchEvent): void {
    this.mode = Mode.ZOOMING;
    this.pinchStartDist = this.getPinchDistance(e);
    this.lastScale = this.scale;
    this.pinchStartMid = this.getAverageCoordinates(e);
    this.pinchStartOffset = { ...this.offset };
  }

  private continueZooming(e: TouchEvent): void {
    const newDist = this.getPinchDistance(e);
    if (this.pinchStartDist === 0) return;
    let newScale = this.lastScale * (newDist / this.pinchStartDist);
    newScale = Math.max(0.2, Math.min(newScale, 5)); // Clamp zoom
    // Calculate new offset so zoom is centered on pinch midpoint
    const mid = this.getAverageCoordinates(e);
    const dx = (mid.x - this.pinchStartMid.x) / this.scale;
    const dy = (mid.y - this.pinchStartMid.y) / this.scale;
    // Adjust offset to keep the pinch center stable
    const scaleRatio = newScale / this.lastScale;
    this.offset = {
      x: (this.pinchStartOffset.x + dx - (this.pinchStartMid.x - this.pinchStartOffset.x) * (scaleRatio - 1)),
      y: (this.pinchStartOffset.y + dy - (this.pinchStartMid.y - this.pinchStartOffset.y) * (scaleRatio - 1)),
    };
    this.scale = newScale;
    this.redraw();
  }

  private stopZooming(): void {
    this.mode = Mode.IDLE;
    this.pinchStartDist = 0;
  }

  // ************* PANNING *************
  private startPanning(e: TouchEvent): void {
    this.mode = Mode.PANNING;
    this.panStart = this.getAverageCoordinates(e);
    this.lastOffset = this.offset;
  }

  private continuePanning(e: TouchEvent): void {
    const currentCoords = this.getAverageCoordinates(e);
    this.offset = {
      x: this.lastOffset.x + (currentCoords.x - this.panStart.x),
      y: this.lastOffset.y + (currentCoords.y - this.panStart.y),
    }
    this.redraw();
  }

  private stopPanning(): void {
    this.mode = Mode.IDLE;
    this.panStart = { x: 0, y: 0 };
  }

  // ************* DRAWING *************
  private startDrawing(e: MouseEvent | TouchEvent): void {
    if (this.mode !== Mode.IDLE) return;
    this.mode = Mode.DRAWING;
    this.hasMoved = false;
    const coords = this.getCoordinates(e);
    this.currentStroke = {
      points: [coords],
      color: this.ctx.strokeStyle,
      width: this.ctx.lineWidth,
    }
  }

  private draw(e: MouseEvent | TouchEvent): void {
    if (this.mode !== Mode.DRAWING) return;
    this.hasMoved = true;
    const coords = this.getCoordinates(e);
    this.currentStroke?.points.push(coords);
    this.redraw();
  }

  private stopDrawing(): void {
    if (this.mode !== Mode.DRAWING) return;
    if (this.currentStroke) {
      this.strokes.push(this.currentStroke);
      this.currentStroke = null;
    }
    this.redraw();
    this.mode = Mode.IDLE;
  }

  // ************* UTILITIES *************
  private getCoordinates(e: MouseEvent | TouchEvent): Coordinates {
    const rect = this.canvas.getBoundingClientRect();
    const event = e instanceof MouseEvent ? e : e.touches[0] || e.changedTouches[0];
    return {
      x: (event.clientX - rect.left - this.offset.x) / this.scale,
      y: (event.clientY - rect.top - this.offset.y) / this.scale,
    };
  }

  private getAverageCoordinates(e: TouchEvent): Coordinates {
    return {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    }
  }

  private getPinchDistance(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // If we have a drawing in progress, we save it to start the new gesture. OR if it's a dot, we cancel it entirely - stops phantom dots
  private cutoffDrawing(): void {
    if (this.hasMoved) {
      this.stopDrawing();
    } else {
      this.currentStroke = null;
      this.redraw();
    }
  }

  // ************* RENDERING *************
  private redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.offset.x, this.offset.y);
    this.ctx.scale(this.scale, this.scale);
    this.drawStrokes();
    this.ctx.restore();
  }

  private drawStrokes(): void {
    const allStrokes = this.currentStroke ? this.strokes.concat([this.currentStroke]) : this.strokes;
    for (const stroke of allStrokes) {
      this.ctx.strokeStyle = stroke.color;
      this.ctx.lineWidth = stroke.width;
      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach(point => this.ctx.lineTo(point.x, point.y));
      this.ctx.stroke();
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Whiteboard('whiteboard');
});
