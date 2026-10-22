/* ---------------------------------------------------------------------------
 * webgpu-lab / shared/gpu.js
 * A tiny shared renderer used by the WebGPU Lab demos.
 *
 * Design notes
 * ------------
 * Every demo builds a "scene": a flat array of primitives in *pixel* space
 * (CSS pixels; the renderer multiplies by devicePixelRatio internally).
 * The stage then draws that scene with WebGPU (instanced quads + an SDF
 * fragment shader) or, when WebGPU is unavailable, with plain Canvas2D.
 * Both paths consume the identical scene array, so the fallback always
 * shows the same idea, just less shiny.
 *
 * Primitive shape:
 *   { x, y, w, h, rot, color:[r,g,b,a], shape, extra, dash }
 *   shape: 'disc' | 'square' | 'ring' | 'diamond' | 'segment'
 *   extra: ring thickness (0..1 of radius), segment cap
 *   dash:  0 = solid rim; > 0 = number of dashes around a ring
 *
 * No frameworks, no bundler required. This file is plain ES5-ish JS that is
 * concatenated into each demo page by ../build.mjs.
 * ------------------------------------------------------------------------- */
(function (global) {
  "use strict";

  var SHAPES = { disc: 0, square: 1, ring: 2, diamond: 3, segment: 4 };

  /* --------------------------------------------------------------------- */
  /* Canvas2D fallback                                                     */
  /* --------------------------------------------------------------------- */

  function Canvas2DStage(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mode = "canvas2d";
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.resize();
  }

  Canvas2DStage.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.dpr = dpr;
    this.width = rect.width;
    this.height = rect.height;
  };

  Canvas2DStage.prototype.beginFrame = function () {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);
  };

  Canvas2DStage.prototype.render = function (prims) {
    var ctx = this.ctx;
    for (var i = 0; i < prims.length; i++) {
      var p = prims[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      ctx.fillStyle = "rgba(" + p.color[0] + "," + p.color[1] + "," + p.color[2] + "," + (p.color[3] === undefined ? 1 : p.color[3]) + ")";
      ctx.strokeStyle = ctx.fillStyle;
      var hw = p.w / 2;
      var hh = p.h / 2;
      var shape = p.shape || "disc";
      if (shape === "disc") {
        ctx.beginPath();
        ctx.arc(0, 0, hw, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === "square") {
        ctx.fillRect(-hw, -hh, p.w, p.h);
      } else if (shape === "ring") {
        var thickness = p.extra === undefined ? 0.12 : p.extra;
        ctx.lineWidth = Math.max(1, hw * 2 * thickness);
        var radius = Math.max(1, hw - ctx.lineWidth / 2);
        if (p.dash) {
          // match the shader: `dash` is the number of dashes around the rim
          var step = (Math.PI * 2 * radius) / p.dash;
          ctx.setLineDash([step * 0.5, step * 0.5]);
        }
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        if (p.dash) ctx.setLineDash([]);
      } else if (shape === "diamond") {
        var dr = Math.min(hw, hh);
        ctx.beginPath();
        ctx.moveTo(0, -dr);
        ctx.lineTo(dr, 0);
        ctx.lineTo(0, dr);
        ctx.lineTo(-dr, 0);
        ctx.closePath();
        ctx.fill();
      } else if (shape === "segment") {
        var cap = p.extra === undefined ? 0.5 : p.extra;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1, p.h);
        ctx.beginPath();
        ctx.moveTo(-hw, 0);
        ctx.lineTo(hw, 0);
        ctx.stroke();
        if (cap) {
          ctx.beginPath();
          ctx.arc(-hw, 0, p.h / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(hw, 0, p.h / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  };

  Canvas2DStage.prototype.destroy = function () {
    this.ctx = null;
  };

  /* --------------------------------------------------------------------- */
  /* WebGPU stage                                                          */
  /* --------------------------------------------------------------------- */

  var VERTEX_SHADER = [
    "struct VSOut {",
    "  @builtin(position) pos : vec4f,",
    "  @location(0) local : vec2f,",
    "  @location(1) half : vec2f,",
    "  @location(2) color : vec4f,",
    "  @location(3) shape : f32,",
    "  @location(4) extra : f32,",
    "  @location(5) dash : f32,",
    "};",
    "",
    "@group(0) @binding(0) var<uniform> u : vec4f; // res.x, res.y, time, dpr",
    "",
    "@vertex",
    "fn vs(",
    "  @builtin(vertex_index) vi : u32,",
    "  @location(0) center : vec2f,",
    "  @location(1) halfsize : vec2f,",
    "  @location(2) rot : f32,",
    "  @location(3) color : vec4f,",
    "  @location(4) shape : f32,",
    "  @location(5) extra : f32,",
    "  @location(6) dash : f32",
    ") -> VSOut {",
    "  var corners = array<vec2f, 6>(",
    "    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),",
    "    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)",
    "  );",
    "  var c = corners[vi];",
    "  let s = sin(rot);",
    "  let co = cos(rot);",
    "  let rotated = vec2f(c.x * co - c.y * s, c.x * s + c.y * co);",
    "  let world = center + rotated * halfsize;",
    "  let ndc = vec2f(world.x / u.x * 2.0 - 1.0, 1.0 - world.y / u.y * 2.0);",
    "  var out : VSOut;",
    "  out.pos = vec4f(ndc, 0.0, 1.0);",
    "  out.local = c * halfsize;",
    "  out.half = halfsize;",
    "  out.color = color;",
    "  out.shape = shape;",
    "  out.extra = extra;",
    "  out.dash = dash;",
    "  return out;",
    "}"
  ].join("\n");

  // NOTE: the uniform is declared once, in the vertex shader only. Declaring
  // it in both stages of the same module is a WGSL redeclaration error.
  var FRAGMENT_SHADER = [
    "fn sdCircle(p : vec2f, r : f32) -> f32 { return length(p) - r; }",
    "fn sdBox(p : vec2f, b : vec2f) -> f32 {",
    "  let d = abs(p) - b;",
    "  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);",
    "}",
    "fn sdSegment(p : vec2f, a : vec2f, b : vec2f) -> f32 {",
    "  let pa = p - a;",
    "  let ba = b - a;",
    "  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);",
    "  return length(pa - ba * h);",
    "}",
    "",
    "@fragment",
    "fn fs(in : VSOut) -> @location(0) vec4f {",
    "  let p = in.local;",
    "  var d : f32;",
    "  if (in.shape < 0.5) {",
    "    d = sdCircle(p, in.half.x);",
    "  } else if (in.shape < 1.5) {",
    "    d = sdBox(p, in.half);",
    "  } else if (in.shape < 2.5) {",
    "    let r = in.half.x;",
    "    let t = max(1.0, r * 2.0 * in.extra);",
    "    d = abs(sdCircle(p, r)) - t * 0.5;",
    "    if (in.dash > 0.5) {",
    "      let a = atan2(p.y, p.x) / 6.2831853 + 0.5;",
    "      if (fract(a * in.dash) > 0.5) { discard; }",
    "    }",
    "  } else if (in.shape < 3.5) {",
    "    d = abs(p.x) + abs(p.y) - min(in.half.x, in.half.y);",
    "  } else {",
    "    d = sdSegment(p, vec2f(-in.half.x, 0.0), vec2f(in.half.x, 0.0)) - in.half.y * 0.5;",
    "  }",
    "  let aa = 1.0;",
    "  let alpha = 1.0 - smoothstep(-aa, aa, d);",
    "  if (alpha <= 0.003) { discard; }",
    "  return vec4f(in.color.rgb, in.color.a * alpha);",
    "}"
  ].join("\n");

  var MAX_INSTANCES = 4096;
  var FLOATS_PER_INSTANCE = 16; // center2 + half2 + rot + color4 + shape + extra = 11 -> padded to 16

  function WebGPUStage(canvas, device, context) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.mode = "webgpu";
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.buffer = new Float32Array(MAX_INSTANCES * FLOATS_PER_INSTANCE);
    this.count = 0;

    var self = this;
    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.uniformData = new Float32Array(4);

    var module = device.createShaderModule({ code: VERTEX_SHADER + "\n" + FRAGMENT_SHADER });
    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: module,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: FLOATS_PER_INSTANCE * 4,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x2" },
              { shaderLocation: 2, offset: 16, format: "float32" },
              { shaderLocation: 3, offset: 20, format: "float32x4" },
              { shaderLocation: 4, offset: 36, format: "float32" },
              { shaderLocation: 5, offset: 40, format: "float32" },
              { shaderLocation: 6, offset: 44, format: "float32" }
            ]
          }
        ]
      },
      fragment: {
        module: module,
        entryPoint: "fs",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
            }
          }
        ]
      },
      primitive: { topology: "triangle-list" }
    });

    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
    });

    this.instanceBuffer = device.createBuffer({
      size: MAX_INSTANCES * FLOATS_PER_INSTANCE * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.resize();
  }

  WebGPUStage.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.dpr = dpr;
    this.width = rect.width;
    this.height = rect.height;
  };

  WebGPUStage.prototype.beginFrame = function (time) {
    this.uniformData[0] = this.width * this.dpr;
    this.uniformData[1] = this.height * this.dpr;
    this.uniformData[2] = time;
    this.uniformData[3] = this.dpr;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
  };

  WebGPUStage.prototype.render = function (prims) {
    var n = Math.min(prims.length, MAX_INSTANCES);
    var buf = this.buffer;
    for (var i = 0; i < n; i++) {
      var p = prims[i];
      var o = i * FLOATS_PER_INSTANCE;
      buf[o + 0] = p.x * this.dpr;
      buf[o + 1] = p.y * this.dpr;
      buf[o + 2] = (p.w / 2) * this.dpr;
      buf[o + 3] = (p.h / 2) * this.dpr;
      buf[o + 4] = p.rot || 0;
      // colours are given as 0-255 and the shader works in 0-1
      buf[o + 5] = p.color[0] / 255;
      buf[o + 6] = p.color[1] / 255;
      buf[o + 7] = p.color[2] / 255;
      buf[o + 8] = p.color[3] === undefined ? 1 : p.color[3];
      buf[o + 9] = SHAPES[p.shape] === undefined ? 0 : SHAPES[p.shape];
      buf[o + 10] = p.extra === undefined ? 0 : p.extra;
      buf[o + 11] = p.dash === undefined ? 0 : p.dash;
    }
    this.count = n;

    var encoder = this.device.createCommandEncoder();
    this.device.queue.writeBuffer(this.instanceBuffer, 0, buf, 0, n * FLOATS_PER_INSTANCE);
    var view = this.context.getCurrentTexture().createView();
    var pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: view,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.instanceBuffer);
    pass.draw(6, n, 0, 0);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  };

  /**
   * Renders a scene into an OFFSCREEN texture and reads the pixels back.
   * Used by the verification script to prove the WebGPU path really draws
   * geometry in environments where a WebGPU canvas is not composited
   * (headless browsers). Uses the same pipeline and the same instance
   * packing as the on-screen path.
   */
  WebGPUStage.prototype.renderToPixels = function (prims, width, height, options) {
    options = options || {};
    var device = this.device;
    var bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    var texture = device.createTexture({
      size: [width, height],
      format: navigator.gpu.getPreferredCanvasFormat(),
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    var readBuffer = device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // reuse the instance packing + uniform layout of the on-screen path
    var buf = this.buffer;
    var n = Math.min(prims.length, MAX_INSTANCES);
    for (var i = 0; i < n; i++) {
      var p = prims[i];
      var o = i * FLOATS_PER_INSTANCE;
      buf[o + 0] = p.x;
      buf[o + 1] = p.y;
      buf[o + 2] = p.w / 2;
      buf[o + 3] = p.h / 2;
      buf[o + 4] = p.rot || 0;
      // colours are given as 0-255 and the shader works in 0-1
      buf[o + 5] = p.color[0] / 255;
      buf[o + 6] = p.color[1] / 255;
      buf[o + 7] = p.color[2] / 255;
      buf[o + 8] = p.color[3] === undefined ? 1 : p.color[3];
      buf[o + 9] = SHAPES[p.shape] === undefined ? 0 : SHAPES[p.shape];
      buf[o + 10] = p.extra === undefined ? 0 : p.extra;
      buf[o + 11] = p.dash === undefined ? 0 : p.dash;
    }
    var uniforms = new Float32Array([width, height, 0, 1]);
    device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    device.queue.writeBuffer(this.instanceBuffer, 0, buf, 0, n * FLOATS_PER_INSTANCE);
    // the probe runs after this pass is submitted, so it can reuse the
    // shared buffers without disturbing the scene that was just queued

    var encoder = device.createCommandEncoder();
    var pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.instanceBuffer);
    pass.draw(6, n, 0, 0);
    pass.end();
    encoder.copyTextureToBuffer(
      { texture: texture },
      { buffer: readBuffer, bytesPerRow: bytesPerRow, rowsPerImage: height },
      [width, height]
    );
    device.queue.submit([encoder.finish()]);

    var probePromise = options.withPixels ? probePremultiplied(this) : Promise.resolve(false);
    return Promise.all([readBuffer.mapAsync(GPUMapMode.READ), probePromise]).then(function (results) {
      var data = new Uint8Array(readBuffer.getMappedRange());
      var nonZero = 0;
      for (var row = 0; row < height; row++) {
        for (var col = 0; col < width; col++) {
          var idx = row * bytesPerRow + col * 4;
          if (data[idx + 3] > 0) nonZero++;
        }
      }
      var pixels = null;
      var premultiplied = results[1];
      var pixels = null;
      var premultiplied = results[1];
      if (options.debug) {
        return {
          premultiplied: premultiplied,
          raw: [data[0], data[1], data[2], data[3]],
          rawMid: [
            data[Math.floor(height / 2) * bytesPerRow + Math.floor(width / 2) * 4],
            data[Math.floor(height / 2) * bytesPerRow + Math.floor(width / 2) * 4 + 1],
            data[Math.floor(height / 2) * bytesPerRow + Math.floor(width / 2) * 4 + 2],
            data[Math.floor(height / 2) * bytesPerRow + Math.floor(width / 2) * 4 + 3]
          ],
          nonZero: nonZero
        };
      }
      if (options.withPixels) {
        // Tight copy (without the row padding) as base64, so a caller can
        // paint the real GPU output into a 2D canvas.
        // The channel order follows the canvas format and the alpha may be
        // premultiplied - both are undone here so the caller receives
        // straight (non-premultiplied) RGBA.
        var format = navigator.gpu.getPreferredCanvasFormat();
        var swap = format.indexOf("bgra") === 0;
        var out = new Uint8Array(width * height * 4);
        for (var row = 0; row < height; row++) {
          var src = row * bytesPerRow;
          for (var col = 0; col < width; col++) {
            var si = src + col * 4;
            var di = (row * width + col) * 4;
            var r = data[si], g = data[si + 1], b = data[si + 2], a = data[si + 3];
            if (swap) { var tmp = r; r = b; b = tmp; }
            if (premultiplied && a > 0 && a < 255) {
              r = Math.min(255, Math.round((r * 255) / a));
              g = Math.min(255, Math.round((g * 255) / a));
              b = Math.min(255, Math.round((b * 255) / a));
            }
            out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a;
          }
        }
        var binary = "";
        for (var i = 0; i < out.length; i++) binary += String.fromCharCode(out[i]);
        pixels = typeof btoa === "function" ? btoa(binary) : null;
      }
      readBuffer.unmap();
      readBuffer.destroy();
      texture.destroy();
      return { nonZero: nonZero, width: width, height: height, instances: n, pixels: pixels };
    });
  };

  /**
   * Renders a single half-transparent white quad into a 2x2 target and
   * reports whether the backend stored premultiplied colour. The blend
   * convention is not the same everywhere, so it is measured rather than
   * assumed.
   */
  function probePremultiplied(stage) {
    var device = stage.device;
    var format = navigator.gpu.getPreferredCanvasFormat();
    var texture = device.createTexture({
      size: [2, 2],
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    var buffer = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    // the probe owns its uniform and instance buffers so it cannot disturb
    // the scene that is being rendered
    var uniform = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    var instance = device.createBuffer({
      size: FLOATS_PER_INSTANCE * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    var bindGroup = device.createBindGroup({
      layout: stage.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniform } }]
    });

    // a half-transparent white quad covering the whole 2x2 target
    var probe = new Float32Array(FLOATS_PER_INSTANCE);
    probe[0] = 1; probe[1] = 1; probe[2] = 1; probe[3] = 1;
    probe[4] = 0; probe[5] = 255; probe[6] = 255; probe[7] = 255; probe[8] = 128;
    probe[9] = 0; probe[10] = 0; probe[11] = 0;
    device.queue.writeBuffer(uniform, 0, new Float32Array([2, 2, 0, 1]));
    device.queue.writeBuffer(instance, 0, probe, 0, FLOATS_PER_INSTANCE);

    var encoder = device.createCommandEncoder();
    var pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: texture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }
      ]
    });
    pass.setPipeline(stage.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, instance);
    pass.draw(6, 1, 0, 0);
    pass.end();
    encoder.copyTextureToBuffer({ texture: texture }, { buffer: buffer, bytesPerRow: 256, rowsPerImage: 2 }, [2, 2]);
    device.queue.submit([encoder.finish()]);

    return buffer.mapAsync(GPUMapMode.READ).then(function () {
      var data = new Uint8Array(buffer.getMappedRange());
      var r = data[0];
      var a = data[3];
      buffer.unmap();
      buffer.destroy();
      uniform.destroy();
      instance.destroy();
      texture.destroy();
      // half the colour stored => the target holds premultiplied colour
      return a > 0 && r < 200;
    });
  }

  WebGPUStage.prototype.destroy = function () {
    try {
      this.uniformBuffer.destroy();
      this.instanceBuffer.destroy();
    } catch (e) {
      /* ignore */
    }
  };

  /* --------------------------------------------------------------------- */
  /* Public API                                                            */
  /* --------------------------------------------------------------------- */

  function isSupported() {
    return typeof navigator !== "undefined" && !!navigator.gpu;
  }

  /**
   * Creates a stage for `canvas`.
   * Resolves with { stage, mode, error }. Never rejects: when WebGPU is
   * unavailable or fails, a Canvas2D stage is returned instead and `error`
   * explains why.
   */
  function createStage(canvas, options) {
    options = options || {};
    if (!isSupported()) {
      return Promise.resolve({
        stage: new Canvas2DStage(canvas),
        mode: "canvas2d",
        error: "WebGPU is not available in this browser."
      });
    }
    return navigator.gpu
      .requestAdapter(options.adapterOptions || {})
      .then(function (adapter) {
        if (!adapter) throw new Error("No WebGPU adapter was returned by the browser.");
        return adapter.requestDevice();
      })
      .then(function (device) {
        device.lost.then(function (info) {
          if (options.onDeviceLost) options.onDeviceLost(info);
        });
        var context = canvas.getContext("webgpu");
        if (!context) throw new Error("Could not create a WebGPU canvas context.");
        var format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device: device, format: format, alphaMode: "premultiplied" });
        return { stage: new WebGPUStage(canvas, device, context), mode: "webgpu", error: null };
      })
      .catch(function (err) {
        if (options.onError) options.onError(err);
        return {
          stage: new Canvas2DStage(canvas),
          mode: "canvas2d",
          error: (err && err.message) || String(err)
        };
      });
  }

  /**
   * Runs a render loop with delta time.
   * `update(dt, elapsed)` advances the scene, `render(scene)` draws it.
   * If `reduced` is true the loop stays paused until `play()` is called.
   */
  function createLoop(options) {
    var update = options.update;
    var render = options.render;
    var reduced = !!options.reduced;
    var paused = reduced;
    var last = 0;
    var elapsed = 0;
    var raf = 0;
    var running = false;

    function frame(now) {
      if (!running) return;
      raf = global.requestAnimationFrame(frame);
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!paused) {
        elapsed += dt;
        update(dt, elapsed);
      }
      render(elapsed);
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        last = 0;
        raf = global.requestAnimationFrame(frame);
      },
      stop: function () {
        running = false;
        global.cancelAnimationFrame(raf);
      },
      play: function () {
        paused = false;
        last = 0;
      },
      pause: function () {
        paused = true;
      },
      toggle: function () {
        if (paused) this.play();
        else this.pause();
        return !paused;
      },
      isPaused: function () {
        return paused;
      },
      get elapsed() {
        return elapsed;
      }
    };
  }

  function prefersReducedMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  global.WebGPULab = {
    isSupported: isSupported,
    shaders: { vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER },
    createStage: createStage,
    createLoop: createLoop,
    prefersReducedMotion: prefersReducedMotion,
    SHAPES: SHAPES,
    version: "1.0.0"
  };
})(typeof window !== "undefined" ? window : this);
