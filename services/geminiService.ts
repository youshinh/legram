import { GoogleGenAI, Type } from "@google/genai";
import { GridSize, VoxelData } from "../types";

// --- Configuration ---
const MODEL_NAME = "gemini-3-flash-preview";

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Interfaces & Schema ---

interface VoxelAgentResponse {
  name: string;
  description: string;
  mode: "shader" | "particle";
  shaderLogic?: string;
  particleParams?: {
    count: number;
    emitter: number[];
    velocity: number[];
    gravity: number;
    spread: number;
    lifetime: number;
    behavior: "explode" | "rain" | "rise";
  };
}

// JSON Schema
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    mode: { type: Type.STRING, enum: ["shader", "particle"] },
    shaderLogic: { 
      type: Type.STRING, 
      description: "JavaScript expression for Math mode. Vars: x,y,z,t,d,r,noise(x,y,z,t)" 
    },
    particleParams: {
      type: Type.OBJECT,
      properties: {
        count: { type: Type.INTEGER },
        emitter: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        velocity: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        gravity: { type: Type.NUMBER },
        spread: { type: Type.NUMBER },
        lifetime: { type: Type.NUMBER },
        behavior: { type: Type.STRING, enum: ["explode", "rain", "rise"] }
      }
    }
  },
  required: ["name", "description", "mode"]
};

// --- System Instruction ---

const SYSTEM_INSTRUCTION = `
Role: You are a "Voxel Engine Orchestrator" for an 8x8x8 3D LED Matrix.
Goal: Analyze the user's request and choose the best rendering engine ("shader" or "particle").

Grid System:
- x, y, z: 0 to 7 (float allowed in particles)
- t: 0.0 to 1.0 (Animation Loop)

Router Logic:
1. **Shader Mode**: Best for geometric patterns, waves, spirals, pulsing shapes.
   - Output 'shaderLogic': A single line JS expression returning brightness (0-255).
   - Context Vars: x, y, z, t, d (dist from center), r (radius 2D), noise(x,y,z,t).
   
2. **Particle Mode**: Best for rain, fire, snow, fireworks, moving objects.
   - Output 'particleParams': Physics settings.
   - 'explode': Burst from center (Fireworks).
   - 'rain': Fall from top (Rain, Snow).
   - 'rise': Float up (Bubbles, Fire).

Constraints:
- Response must be valid JSON.
- Shader expressions must be robust.
`;

// --- Client-Side Engines ---

const noise = (x: number, y: number, z: number, t: number) => {
  const n = Math.sin(x * 12.989 + y * 78.233 + z * 37.719 + t * 5.2) * 43758.5453;
  return n - Math.floor(n);
};

const renderShader = (logic: string, gridSize: GridSize): VoxelData => {
  const frames: VoxelData = [];
  const cx = 3.5, cy = 3.5, cz = 3.5;
  
  let shaderFunc: Function;
  try {
    // eslint-disable-next-line no-new-func
    shaderFunc = new Function('x', 'y', 'z', 't', 'd', 'r', 'noise', `return ${logic};`);
  } catch (e) {
    console.warn("Shader syntax error, fallback to pulse.", e);
    // eslint-disable-next-line no-new-func
    shaderFunc = new Function('x', 'y', 'z', 't', `return Math.sin(t*10)*255;`);
  }

  for (let i = 0; i < 32; i++) {
    const t = i / 31.0;
    const grid: number[][][] = [];
    for (let z = 0; z < gridSize.z; z++) {
      const row: number[][] = [];
      for (let y = 0; y < gridSize.y; y++) {
        const col: number[] = [];
        for (let x = 0; x < gridSize.x; x++) {
          const d = Math.sqrt((x-cx)**2 + (y-cy)**2 + (z-cz)**2);
          const r = Math.sqrt((x-cx)**2 + (z-cz)**2);
          let val = 0;
          try {
            val = shaderFunc(x, y, z, t, d, r, noise);
          } catch(e) { val = 0; }
          col.push(Math.max(0, Math.min(255, val || 0)));
        }
        row.push(col);
      }
      grid.push(row);
    }
    frames.push(grid);
  }
  return frames;
};

const renderParticles = (params: VoxelAgentResponse["particleParams"], gridSize: GridSize): VoxelData => {
  if (!params) return [];
  const frames: VoxelData = [];
  const { count, emitter, velocity, gravity, spread, lifetime, behavior } = params;

  // パーティクル初期化
  const particles = Array.from({ length: count }, () => ({
    x: emitter[0], y: emitter[1], z: emitter[2],
    vx: velocity[0] + (Math.random() - 0.5) * spread,
    vy: velocity[1] + (Math.random() - 0.5) * spread,
    vz: velocity[2] + (Math.random() - 0.5) * spread,
    life: Math.random() * lifetime, 
    active: true
  }));

  if (behavior === 'rain') {
    particles.forEach(p => {
      p.x = Math.random() * 7;
      p.z = Math.random() * 7;
      p.y = Math.random() * 7 + 2; 
      p.life = Math.random() * lifetime;
    });
  }

  for (let f = 0; f < 32; f++) {
    const grid = Array.from({ length: 8 }, () => 
      Array.from({ length: 8 }, () => Array(8).fill(0))
    );

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vy += gravity; 
      p.life -= 1;

      const isOutOfBounds = p.y < -1 || p.y > 9 || p.x < -1 || p.x > 9 || p.z < -1 || p.z > 9;
      if (p.life <= 0 || isOutOfBounds) {
        if (behavior === 'explode') {
           p.active = false; 
           if (f > 20) { p.x=emitter[0]; p.y=emitter[1]; p.z=emitter[2]; p.vy=velocity[1]+0.2; p.life=lifetime; }
        } else if (behavior === 'rain' || behavior === 'rise') {
           p.y = (gravity < 0) ? 8.5 : -0.5; 
           p.x = Math.random() * 7;
           p.z = Math.random() * 7;
           p.vy = velocity[1];
           p.life = lifetime;
        }
      }

      const gx = Math.round(p.x);
      const gy = Math.round(p.y);
      const gz = Math.round(p.z);

      if (gx >= 0 && gx < 8 && gy >= 0 && gy < 8 && gz >= 0 && gz < 8) {
        grid[gz][gy][gx] = Math.min(255, grid[gz][gy][gx] + 200);
        [[0,1,0], [0,-1,0], [1,0,0], [-1,0,0], [0,0,1], [0,0,-1]].forEach(([dx, dy, dz]) => {
           const nx = gx+dx, ny = gy+dy, nz = gz+dz;
           if(nx>=0 && nx<8 && ny>=0 && ny<8 && nz>=0 && nz<8) {
              grid[nz][ny][nx] = Math.max(grid[nz][ny][nx], 50);
           }
        });
      }
    });

    frames.push(grid);
  }

  return frames;
};

// --- Main Service Functions ---

/**
 * Main Function 1: Voxel Animation Generator
 * 修正: response.text() ではなく response.text プロパティを使用
 */
export const generateAnimationWithAI = async (
  prompt: string,
  gridSize: GridSize = { x: 8, y: 8, z: 8 }
): Promise<{ name: string; description: string; data: VoxelData } | null> => {
  try {
    const ai = getClient();
    
    // @google/genai SDK の generateContent 呼び出し
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ text: `Create animation for: ${prompt}` }]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.5,
      }
    });

    // 修正箇所: 関数呼び出しではなくプロパティとしてアクセス
    const responseText = response.text;
    
    if (!responseText) throw new Error("No response text from AI");

    const parsed: VoxelAgentResponse = JSON.parse(responseText);
    console.log(`[HAVE] Mode: ${parsed.mode}`, parsed);

    let voxelData: VoxelData = [];

    if (parsed.mode === "shader" && parsed.shaderLogic) {
      voxelData = renderShader(parsed.shaderLogic, gridSize);
    } else if (parsed.mode === "particle" && parsed.particleParams) {
      voxelData = renderParticles(parsed.particleParams, gridSize);
    } else {
      console.warn("Unknown mode or missing params. Using fallback.");
      voxelData = renderShader("Math.sin(d - t*10)*255", gridSize);
    }

    return {
      name: parsed.name,
      description: parsed.description,
      data: voxelData
    };

  } catch (error) {
    console.error("AI Generation Error:", error);
    return null;
  }
};

/**
 * Main Function 2: Simple Chat
 * 修正: response.text() ではなく response.text プロパティを使用
 */
export const chatWithGeminiSimple = async (
  message: string,
  _gridSize: GridSize
): Promise<string> => {
  try {
    const ai = getClient();
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ text: `You are an LED Cube Assistant. Answer briefly in Japanese. User: ${message}` }]
      }
    });

    // 修正箇所: プロパティとしてアクセス
    return response.text || "応答を取得できませんでした。";
  } catch (error) {
    console.error("Chat Error:", error);
    return "AIエラーが発生しました。";
  }
};