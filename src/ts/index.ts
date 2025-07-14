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
  PANNING = "panning",
}

class Whiteboard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: Mode.IDLE | Mode.DRAWING | Mode.PANNING = Mode.IDLE;

  // drawing
  private hasMoved: boolean = false;

  // panning
  private panStart: Coordinates = { x: 0, y: 0 };
  private offset: Coordinates = { x: 0, y: 0 };
  private lastOffset: Coordinates = { x: 0, y: 0 };
  private strokes: Stroke[] = [];
  private currentStroke: Stroke | null = null;

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
    console.log('e.touches.length :>> ', e.touches.length);
    console.log('this.mode :>> ', this.mode);
    console.log('this.hasMoved :>> ', this.hasMoved);

    if (e.touches.length === 2) {
      this.startPanning(e);
    } else if (e.touches.length === 1) {
      this.startDrawing(e);
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (this.mode === Mode.PANNING && e.touches.length === 2) {
      this.continuePanning(e);
    } else if (this.mode === Mode.DRAWING && e.touches.length === 1) {
      this.draw(e);
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (this.mode === Mode.PANNING && e.touches.length < 2) {
      this.stopPanning();
    } else if (this.mode === Mode.DRAWING && e.touches.length === 0) {
      this.stopDrawing(e);
    }
  }
  
  // ************* PANNING *************
  private startPanning(e: TouchEvent): void {
    if (this.mode === Mode.DRAWING) {
      if (this.hasMoved) {
        this.stopDrawing(e)
      } else {
        // We only keep the current stroke if we've moved - this is to stop phantom dots
        this.currentStroke = null;
        this.redraw();
      }
    }
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

  private stopDrawing(e: MouseEvent | TouchEvent): void {
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
      x: event.clientX - rect.left - this.offset.x,
      y: event.clientY - rect.top - this.offset.y,
    };
  }

  private getAverageCoordinates(e: TouchEvent): Coordinates {
    return {
      x: e.touches[0].clientX + e.touches[1].clientX / 2,
      y: e.touches[0].clientY + e.touches[1].clientY / 2,
    }
  }

  // ************* RENDERING *************
  private redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.offset.x, this.offset.y);

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
