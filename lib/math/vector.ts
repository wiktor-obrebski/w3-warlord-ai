import type { Point } from "./point";

const TOLERANCE = 0.000001;
const TWO_PI = Math.PI * 2;

export class Vector {
  public readonly x: number;
  public readonly y: number;

  public constructor(x: number, y: number);
  public constructor(start: Point, end: Point);
  public constructor(...args: [number, number] | [Point, Point]) {
    const [first, second] = args;

    if (typeof first === "number" && typeof second === "number") {
      this.x = first;
      this.y = second;
      return;
    }

    if (isPoint(first) && isPoint(second)) {
      this.x = second.x - first.x;
      this.y = second.y - first.y;
      return;
    }
  }

  public clone(): Vector {
    return new Vector(this.x, this.y);
  }

  public get slope(): number {
    const angle = Math.atan2(this.y, this.x);
    return angle < 0 ? angle + TWO_PI : angle;
  }

  public get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public isZeroLength(): boolean {
    return this.length < TOLERANCE;
  }

  public equalTo(vector: Vector): boolean {
    return equalNumber(this.x, vector.x) && equalNumber(this.y, vector.y);
  }

  public multiply(scalar: number): Vector {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  public dot(vector: Vector): number {
    return this.x * vector.x + this.y * vector.y;
  }

  public cross(vector: Vector): number {
    return this.x * vector.y - this.y * vector.x;
  }

  public normalize(): Vector {
    const length = this.length;

    if (length < TOLERANCE) {
      throw new Error("Cannot normalize a zero-length vector");
    }

    return new Vector(this.x / length, this.y / length);
  }

  public rotate(angle: number): Vector {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new Vector(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos,
    );
  }

  public rotate90CCW(): Vector {
    return new Vector(-this.y, this.x);
  }

  public rotate90CW(): Vector {
    return new Vector(this.y, -this.x);
  }

  public invert(): Vector {
    return new Vector(-this.x, -this.y);
  }

  public add(vector: Vector): Vector {
    return new Vector(this.x + vector.x, this.y + vector.y);
  }

  public subtract(vector: Vector): Vector {
    return new Vector(this.x - vector.x, this.y - vector.y);
  }

  public angleTo(vector: Vector): number {
    const first = this.normalize();
    const second = vector.normalize();
    let angle = Math.atan2(first.cross(second), first.dot(second));

    if (angle < 0) {
      angle += TWO_PI;
    }

    return angle;
  }

  public projectionOn(vector: Vector): Vector {
    const normalized = vector.normalize();
    return normalized.multiply(this.dot(normalized));
  }
}

function equalNumber(a: number, b: number): boolean {
  const difference = a - b;
  return difference < TOLERANCE && difference > -TOLERANCE;
}

function isPoint(value: number | Point | undefined): value is Point {
  return typeof value === "object" && value !== undefined;
}
