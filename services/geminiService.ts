import { GoogleGenAI, Type } from "@google/genai";
import { GridSize, VoxelData } from "../types";

// --- Configuration ---
const MODEL_NAME = "gemini-3-pro-preview";

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Interfaces & Schema ---
interface VoxelAgentResponse {
  name: string;
  description: string;
  mode: "shader" | "particle";
  logic?: string;
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

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    mode: { type: Type.STRING, enum: ["shader", "particle"] },
    logic: { type: Type.STRING, description: "One-line JS expression returning 0-255." },
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
Role: Voxel Engine Orchestrator for a variable size 3D LED Matrix (Default 32x32x32).
Goal: Create visual effects resolution-independently.

Coordinate System:
- **Y-Axis**: Vertical Height. 0 is Floor.
- **XZ-Plane**: Horizontal Ground.
- **Input Variables**:
  - x, y, z : Integer coordinates (0 to grid_max)
  - nx, ny, nz : **Normalized coordinates (0.0 to 1.0)**. Use these for resolution-independent patterns!
  - t : Time (0.0 to 1.0)
  - d : Normalized distance from center (0.0 to ~1.0)
  - n(nx, ny, nz) : Noise function using normalized coords

Router Logic:
1. **Shader Mode**: 
   - PREFER utilizing 'nx', 'ny', 'nz' over 'x', 'y', 'z' to keep patterns consistent across different grid sizes.
   - Example: "Math.sin(nx * Math.PI * 4 + t * 10) * 255" (Creates 2 waves regardless of size)

2. **Particle Mode**:
   - Coordinates are relative to grid size.
   - For emitter position, use normalized values [0.0-1.0] in the JSON, and the client will scale them.
`;

// --- Engines (Shader & Particle) ---
const simpleNoise = (x: number, y: number, z: number): number => {
  const val = Math.sin(x * 12.9898 + y * 78.233 + z * 54.53) * 43758.5453;
  return val - Math.floor(val);
};

const renderShader = (logic: string, gridSize: GridSize): VoxelData => {
  const frames: VoxelData = [];
  const cx = (gridSize.x - 1) / 2;
  const cy = (gridSize.y - 1) / 2;
  const cz = (gridSize.z - 1) / 2;
  const mx = Math.max(1, gridSize.x - 1), my = Math.max(1, gridSize.y - 1), mz = Math.max(1, gridSize.z - 1);
  
  let shaderFunc: Function;
  try {
    // eslint-disable-next-line no-new-func
    shaderFunc = new Function('x', 'y', 'z', 't', 'd', 'r', 'n', 'cx', 'cy', 'cz', 'nx', 'ny', 'nz', `return ${logic};`);
  } catch (e) {
    // eslint-disable-next-line no-new-func
    shaderFunc = new Function('t', `return Math.sin(t*10)*255;`);
  }

  for (let i = 0; i < 32; i++) {
    const t = i / 31.0;
    const grid: number[][][] = [];
    for (let z = 0; z < gridSize.z; z++) {
      const row: number[][] = [];
      const nz = z / mz;
      for (let y = 0; y < gridSize.y; y++) {
        const col: number[] = [];
        const ny = y / my;
        for (let x = 0; x < gridSize.x; x++) {
          const nx = x / mx;
          const d = Math.sqrt((nx-0.5)**2 + (ny-0.5)**2 + (nz-0.5)**2) * 2;
          const r = Math.sqrt((nx-0.5)**2 + (nz-0.5)**2) * 2;
          let val = 0;
          try {
            val = shaderFunc(x, y, z, t, d, r, simpleNoise, cx, cy, cz, nx, ny, nz);
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
  const scalePos = (val: number, max: number) => (val <= 1.0 && val >= 0) ? val * max : val;
  const ex = scalePos(emitter[0], gridSize.x), ey = scalePos(emitter[1], gridSize.y), ez = scalePos(emitter[2], gridSize.z);

  const particles = Array.from({ length: count }, () => ({
    x: ex, y: ey, z: ez,
    vx: velocity[0] + (Math.random() - 0.5) * spread,
    vy: velocity[1] + (Math.random() - 0.5) * spread,
    vz: velocity[2] + (Math.random() - 0.5) * spread,
    life: Math.random() * lifetime, active: true
  }));

  if (behavior === 'rain') {
    particles.forEach(p => {
      p.x = Math.random() * gridSize.x; p.z = Math.random() * gridSize.z; p.y = Math.random() * (gridSize.y/2) + gridSize.y/2; p.life = Math.random() * lifetime;
    });
  }

  for (let f = 0; f < 32; f++) {
    const grid = Array.from({ length: gridSize.z }, () => Array.from({ length: gridSize.y }, () => Array(gridSize.x).fill(0)));
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vy += gravity; p.life -= 1;
      const isOutOfBounds = p.y < -5 || p.y > gridSize.y+5 || p.x < -5 || p.x > gridSize.x+5 || p.z < -5 || p.z > gridSize.z+5;
      if (p.life <= 0 || isOutOfBounds) {
        if (behavior === 'explode') {
           p.active = false;
           if (f > 20) { p.x=ex; p.y=ey; p.z=ez; p.vx=velocity[0]+(Math.random()-0.5)*spread; p.vy=velocity[1]+(Math.random()-0.5)*spread; p.vz=velocity[2]+(Math.random()-0.5)*spread; p.life=lifetime; }
        } else if (behavior === 'rain') { p.y=gridSize.y+1; p.x=Math.random()*gridSize.x; p.z=Math.random()*gridSize.z; p.vy=velocity[1]; p.life=lifetime; } 
        else if (behavior === 'rise') { p.y=-1; p.x=Math.random()*gridSize.x; p.z=Math.random()*gridSize.z; p.vy=velocity[1]; p.life=lifetime; }
      }
      const gx = Math.round(p.x), gy = Math.round(p.y), gz = Math.round(p.z);
      if (gx>=0 && gx<gridSize.x && gy>=0 && gy<gridSize.y && gz>=0 && gz<gridSize.z) {
        grid[gz][gy][gx] = Math.min(255, grid[gz][gy][gx] + 200);
      }
    });
    frames.push(grid);
  }
  return frames;
};

// --- Main Service Functions ---

export const generateAnimationWithAI = async (
  prompt: string,
  gridSize: GridSize = { x: 8, y: 8, z: 8 },
  imageBase64?: string // 画像データ引数を追加
): Promise<{ name: string; description: string; data: VoxelData } | null> => {
  try {
    const ai = getClient();
    
    // コンテンツの構築
    const parts: any[] = [];
    
    // 画像がある場合は先頭に追加
    if (imageBase64) {
      // "data:image/png;base64,..." のヘッダーを除去
      const cleanBase64 = imageBase64.split(',')[1];
      // MIMEタイプ取得 (簡易的)
      const mimeMatch = imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      });
    }
    
    // テキストプロンプトを追加
    parts.push({ text: `Create animation for: ${prompt}` });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.5,
      }
    });

    const responseText = response.text;
    if (!responseText) throw new Error("No response from AI");

    const parsed: VoxelAgentResponse = JSON.parse(responseText);
    console.log(`[HAVE] Mode: ${parsed.mode}`, parsed);

    let voxelData: VoxelData = [];
    const logicStr = parsed.logic;

    if (parsed.mode === "shader" && logicStr) {
      voxelData = renderShader(logicStr, gridSize);
    } else if (parsed.mode === "particle" && parsed.particleParams) {
      voxelData = renderParticles(parsed.particleParams, gridSize);
    } else {
      console.warn("Using fallback shader.");
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
    return response.text || "応答を取得できませんでした。";
  } catch (error) {
    console.error("Chat Error:", error);
    return "AIエラーが発生しました。";
  }
};