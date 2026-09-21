export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DetectorResult {
  label: string;
  score: number;
  injectionScore: number;
}

const TARGET_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const DETECTOR_MODEL = "ASD492/pi-detector";

let enginePromise: Promise<any> | null = null;
let detectorPromise: Promise<any> | null = null;

export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function loadTargetEngine(
  onProgress: (pct: number, text: string) => void
): Promise<any> {
  if (!enginePromise) {
    enginePromise = import("@mlc-ai/web-llm")
      .then((webllm: any) =>
        webllm.CreateMLCEngine(TARGET_MODEL, {
          initProgressCallback: (r: any) =>
            onProgress(Math.round((r.progress ?? 0) * 100), r.text ?? ""),
        })
      )
      .catch((e) => {
        enginePromise = null;
        throw e;
      });
  }
  return enginePromise;
}

export function loadDetector(
  onProgress: (pct: number, text: string) => void
): Promise<any> {
  if (!detectorPromise) {
    detectorPromise = import("@huggingface/transformers")
      .then(async (tf: any) => {
        const useGPU = hasWebGPU();
        return tf.pipeline("text-classification", DETECTOR_MODEL, {
          device: useGPU ? "webgpu" : "wasm",
          dtype: useGPU ? "fp16" : "fp32",
          progress_callback: (p: any) => {
            if (p.status === "progress" && p.total) {
              onProgress(Math.round((p.loaded / p.total) * 100), `detector: ${p.file}`);
            }
          },
        });
      })
      .catch((e) => {
        detectorPromise = null;
        throw e;
      });
  }
  return detectorPromise;
}

const LABEL_MAP: Record<string, string> = { SAFE: "SAFE", INJECTION: "INJECTION" };

export async function classifyInput(text: string): Promise<DetectorResult> {
  const detector = await detectorPromise;
  if (!detector || !text.trim()) {
    return { label: "SAFE", score: 0, injectionScore: 0 };
  }
  const out: any[] = await detector(text, { topk: 2 });
  let injectionScore = 0;
  for (const r of out) {
    if ((LABEL_MAP[r.label] ?? r.label) === "INJECTION") injectionScore = r.score;
  }
  const label = injectionScore >= 0.5 ? "INJECTION" : "SAFE";
  return { label, score: Math.max(...out.map((r) => r.score)), injectionScore };
}

export async function streamChat(
  messages: ChatMsg[],
  onDelta: (full: string) => void
): Promise<string> {
  const engine = await enginePromise;
  const chunks = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.8,
    top_p: 0.95,
    max_tokens: 140,
  });
  let full = "";
  for await (const chunk of chunks) {
    const delta = chunk?.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      onDelta(full);
    }
  }
  return full;
}
