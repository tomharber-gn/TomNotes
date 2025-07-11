import '../styles/global.scss';
import '../styles/global.css';

type Coordinates = {
  x: number;
  y: number;
}

class Whiteboard {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private hasMoved: boolean = false;

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

    this.canvas.addEventListener('touchstart', this.startDrawing.bind(this));
    this.canvas.addEventListener('touchmove', this.draw.bind(this));
    this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
    this.canvas.addEventListener('touchcancel', this.stopDrawing.bind(this));
  }

  private startDrawing(e: MouseEvent | TouchEvent): void {
    this.isDrawing = true;
    this.hasMoved = false;
    const coords = this.getCoordinates(e);
    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  private draw(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) return;
    this.hasMoved = true;
    const coords = this.getCoordinates(e);
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();

    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  private stopDrawing(e: MouseEvent | TouchEvent): void {
    if (this.isDrawing && !this.hasMoved) {
      this.drawDot(e);
    }
    this.isDrawing = false;
  }

  private drawDot(e: MouseEvent | TouchEvent): void {
    const coords = this.getCoordinates(e);
    this.ctx.beginPath();
    this.ctx.arc(coords.x, coords.y, this.ctx.lineWidth / 2, 0, 2 * Math.PI);
    this.ctx.fillStyle = this.ctx.strokeStyle;
    this.ctx.fill();
  }

  private getCoordinates(e: MouseEvent | TouchEvent): Coordinates {
    const rect = this.canvas.getBoundingClientRect();
    
    if (e instanceof MouseEvent) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    } else {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Whiteboard('whiteboard');
});
