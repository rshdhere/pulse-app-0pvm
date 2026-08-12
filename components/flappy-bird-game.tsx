"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const GRAVITY = 0.45;
const JUMP_FORCE = -8.5;
const PIPE_WIDTH = 70;
const PIPE_GAP = 160;
const PIPE_SPEED = 2.5;
const PIPE_INTERVAL = 1800;
const BIRD_SIZE = 28;
const GROUND_HEIGHT = 80;

type GameState = "ready" | "playing" | "gameover";

interface Pipe {
  x: number;
  topHeight: number;
  scored: boolean;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Body
  ctx.fillStyle = "#FACC15";
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#CA8A04";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Wing
  ctx.fillStyle = "#FDE047";
  ctx.beginPath();
  ctx.ellipse(-4, 4, 10, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye white
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(8, -4, 7, 0, Math.PI * 2);
  ctx.fill();

  // Eye pupil
  ctx.fillStyle = "#1E293B";
  ctx.beginPath();
  ctx.arc(10, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = "#F97316";
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(22, 6);
  ctx.lineTo(12, 10);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  topHeight: number
) {
  const bottomY = topHeight + PIPE_GAP;
  const bottomHeight = CANVAS_HEIGHT - GROUND_HEIGHT - bottomY;

  const gradient = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  gradient.addColorStop(0, "#22C55E");
  gradient.addColorStop(0.5, "#4ADE80");
  gradient.addColorStop(1, "#16A34A");

  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#15803D";
  ctx.lineWidth = 3;

  // Top pipe
  drawRoundedRect(ctx, x, 0, PIPE_WIDTH, topHeight, 6);
  ctx.fill();
  ctx.stroke();

  // Top cap
  drawRoundedRect(ctx, x - 4, topHeight - 28, PIPE_WIDTH + 8, 28, 4);
  ctx.fill();
  ctx.stroke();

  // Bottom pipe
  drawRoundedRect(ctx, x, bottomY, PIPE_WIDTH, bottomHeight, 6);
  ctx.fill();
  ctx.stroke();

  // Bottom cap
  drawRoundedRect(ctx, x - 4, bottomY, PIPE_WIDTH + 8, 28, 4);
  ctx.fill();
  ctx.stroke();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  skyGradient.addColorStop(0, "#7DD3FC");
  skyGradient.addColorStop(0.6, "#BAE6FD");
  skyGradient.addColorStop(1, "#E0F2FE");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Clouds
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  const clouds = [
    { x: 60, y: 80, s: 1 },
    { x: 200, y: 50, s: 0.8 },
    { x: 320, y: 120, s: 1.1 },
  ];
  for (const c of clouds) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 22 * c.s, 0, Math.PI * 2);
    ctx.arc(c.x + 25 * c.s, c.y - 8 * c.s, 18 * c.s, 0, Math.PI * 2);
    ctx.arc(c.x + 50 * c.s, c.y, 20 * c.s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground
  const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
  ctx.fillStyle = "#D97706";
  ctx.fillRect(0, groundY, CANVAS_WIDTH, 12);
  ctx.fillStyle = "#65A30D";
  ctx.fillRect(0, groundY + 12, CANVAS_WIDTH, GROUND_HEIGHT - 12);
}

function checkCollision(
  birdX: number,
  birdY: number,
  pipes: Pipe[]
): boolean {
  const birdLeft = birdX - BIRD_SIZE / 2 + 4;
  const birdRight = birdX + BIRD_SIZE / 2 - 4;
  const birdTop = birdY - BIRD_SIZE / 2 + 4;
  const birdBottom = birdY + BIRD_SIZE / 2 - 4;
  const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;

  if (birdTop <= 0 || birdBottom >= groundY) return true;

  for (const pipe of pipes) {
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + PIPE_WIDTH;
    const bottomY = pipe.topHeight + PIPE_GAP;

    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      if (birdTop < pipe.topHeight || birdBottom > bottomY) {
        return true;
      }
    }
  }
  return false;
}

export function FlappyBirdGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    birdY: CANVAS_HEIGHT / 2 - 40,
    birdVelocity: 0,
    birdRotation: 0,
    pipes: [] as Pipe[],
    score: 0,
    lastPipeTime: 0,
    animationId: 0,
  });

  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const resetGame = useCallback(() => {
    const g = gameRef.current;
    g.birdY = CANVAS_HEIGHT / 2 - 40;
    g.birdVelocity = 0;
    g.birdRotation = 0;
    g.pipes = [];
    g.score = 0;
    g.lastPipeTime = 0;
    setScore(0);
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState("playing");
  }, [resetGame]);

  const flap = useCallback(() => {
    if (gameState === "ready") {
      startGame();
      gameRef.current.birdVelocity = JUMP_FORCE;
      return;
    }
    if (gameState === "playing") {
      gameRef.current.birdVelocity = JUMP_FORCE;
    }
    if (gameState === "gameover") {
      startGame();
      gameRef.current.birdVelocity = JUMP_FORCE;
    }
  }, [gameState, startGame]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      const g = gameRef.current;
      const playing = gameState === "playing";

      if (playing) {
        g.birdVelocity += GRAVITY;
        g.birdY += g.birdVelocity;
        g.birdRotation = Math.min(
          Math.max(g.birdVelocity * 0.06, -0.5),
          1.2
        );

        if (time - g.lastPipeTime > PIPE_INTERVAL) {
          const minTop = 80;
          const maxTop =
            CANVAS_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 80;
          const topHeight =
            minTop + Math.random() * (maxTop - minTop);
          g.pipes.push({ x: CANVAS_WIDTH, topHeight, scored: false });
          g.lastPipeTime = time;
        }

        for (const pipe of g.pipes) {
          pipe.x -= PIPE_SPEED;
        }
        g.pipes = g.pipes.filter((p) => p.x > -PIPE_WIDTH);

        for (const pipe of g.pipes) {
          if (
            !pipe.scored &&
            pipe.x + PIPE_WIDTH < CANVAS_WIDTH / 2 - BIRD_SIZE / 2
          ) {
            pipe.scored = true;
            g.score += 1;
            setScore(g.score);
          }
        }

        if (checkCollision(CANVAS_WIDTH / 2, g.birdY, g.pipes)) {
          setGameState("gameover");
          setHighScore((prev) => Math.max(prev, g.score));
        }
      } else if (gameState === "ready") {
        g.birdY =
          CANVAS_HEIGHT / 2 -
          40 +
          Math.sin(time / 300) * 8;
        g.birdRotation = 0;
      }

      drawBackground(ctx);

      for (const pipe of g.pipes) {
        drawPipe(ctx, pipe.x, pipe.topHeight);
      }

      drawBird(ctx, CANVAS_WIDTH / 2, g.birdY, g.birdRotation);

      // Score display on canvas during play
      if (playing || gameState === "gameover") {
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 4;
        ctx.font = "bold 48px system-ui, sans-serif";
        ctx.textAlign = "center";
        const text = String(g.score);
        ctx.strokeText(text, CANVAS_WIDTH / 2, 70);
        ctx.fillText(text, CANVAS_WIDTH / 2, 70);
      }

      gameRef.current.animationId = requestAnimationFrame(loop);
    };

    gameRef.current.animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameRef.current.animationId);
  }, [gameState]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-sky-100 to-sky-50 p-4">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
          Flappy Bird
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap, click, or press Space to flap
        </p>
      </header>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border-4 border-slate-800 shadow-2xl cursor-pointer touch-manipulation"
          onClick={flap}
          onTouchStart={(e) => {
            e.preventDefault();
            flap();
          }}
          aria-label="Flappy Bird game canvas"
          role="img"
        />

        {gameState === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/25">
            <div className="rounded-lg bg-white/95 px-6 py-4 text-center shadow-lg">
              <p className="text-lg font-semibold text-slate-800">
                Ready to fly?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click or press Space to start
              </p>
            </div>
          </div>
        )}

        {gameState === "gameover" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
            <div className="rounded-lg bg-white px-6 py-5 text-center shadow-xl">
              <p className="text-xl font-bold text-slate-800">Game Over</p>
              <p className="mt-2 text-3xl font-bold text-primary">
                Score: {score}
              </p>
              {highScore > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Best: {highScore}
                </p>
              )}
              <Button
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  flap();
                }}
              >
                Play Again
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Score: {score}</span>
        {highScore > 0 && <span>Best: {highScore}</span>}
      </div>
    </div>
  );
}
