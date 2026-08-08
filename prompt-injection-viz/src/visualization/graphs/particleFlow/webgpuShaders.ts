export const PARTICLE_STRIDE_FLOATS = 16;

export const COMPUTE_SHADER = /* wgsl */ `
struct Particle {
  from: vec2f,
  pos: vec2f,
  target: vec2f,
  color: vec3f,
  speed: f32,
  size: f32,
  phase: f32,
  seed: f32,
}

struct Params {
  screenW: f32,
  screenH: f32,
  dt: f32,
  time: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

fn ease(t: f32) -> f32 {
  return t * t * (3.0 - 2.0 * t);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&particles)) { return; }
  var p = particles[i];
  p.phase = fract(p.phase + p.speed * params.dt);
  let t = ease(p.phase);
  let dx = p.target.x - p.from.x;
  let dy = p.target.y - p.from.y;
  let len = max(0.0001, sqrt(dx * dx + dy * dy));
  let nx = -dy / len;
  let ny = dx / len;
  let amp = 4.0 + p.seed * 12.0;
  let off = sin(p.phase * 6.28318 + p.seed * 6.28318) * amp;
  p.pos = vec2f(p.from.x + dx * t + nx * off, p.from.y + dy * t + ny * off);
  particles[i] = p;
}
`;

export const VERT_SHADER = /* wgsl */ `
struct Particle {
  from: vec2f,
  pos: vec2f,
  target: vec2f,
  color: vec3f,
  speed: f32,
  size: f32,
  phase: f32,
  seed: f32,
}

struct Params {
  screenW: f32,
  screenH: f32,
  dt: f32,
  time: f32,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) uv: vec2f,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOut {
  let p = particles[iid];
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let half = p.size * 0.5;
  let px = p.pos.x + corners[vid].x * half;
  let py = p.pos.y + corners[vid].y * half;
  let clipX = (px / params.screenW) * 2.0 - 1.0;
  let clipY = 1.0 - (py / params.screenH) * 2.0;
  var out: VSOut;
  out.position = vec4f(clipX, clipY, 0.0, 1.0);
  out.color = p.color;
  out.uv = corners[vid] * 0.5 + 0.5;
  return out;
}
`;

export const FRAG_SHADER = /* wgsl */ `
struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) uv: vec2f,
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  let d = length(in.uv - vec2f(0.5));
  let a = smoothstep(0.5, 0.12, d);
  return vec4f(in.color * a * 0.9, a * 0.9);
}
`;
