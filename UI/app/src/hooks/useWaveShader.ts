import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec4 aVertexPosition;
void main() {
  gl_Position = aVertexPosition;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_waveSpeed;
uniform float u_waveAmplitude;
uniform vec2 u_mouse;
uniform vec3 u_highlightColor;
uniform vec3 u_troughColor;
uniform vec3 u_lineColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  st.x *= u_resolution.x / u_resolution.y;
  float t = u_time * u_waveSpeed;
  vec2 mouseOffset = vec2((u_mouse.x - 0.5) * 0.6, (u_mouse.y - 0.5) * 0.3);
  float cosT = cos(mouseOffset.x);
  float sinT = sin(mouseOffset.x);
  st = vec2(st.x * cosT - st.y * sinT, st.x * sinT + st.y * cosT);
  float wave = 0.0;
  float freq = 3.0;
  float amp = u_waveAmplitude;
  for (int i = 0; i < 5; i++) {
    wave += snoise(st * freq + t) * amp;
    freq *= 2.1;
    amp *= 0.45;
  }
  wave = smoothstep(-1.0, 1.0, wave);
  float verticalFlow = sin(st.y * 4.0 + t * 1.2) * 0.1;
  wave = wave * 0.9 + verticalFlow * 0.1;
  float lineCount = 7.0;
  float lineSpacing = 1.0 / lineCount;
  float lineIndex = floor(wave / lineSpacing);
  float linePos = wave - (lineIndex * lineSpacing);
  float lineThickness = lineSpacing * 0.25;
  float lineDist = abs(linePos - lineSpacing * 0.5);
  float lineShape = 1.0 - smoothstep(lineThickness * 0.3, lineThickness, lineDist);
  float glow = lineThickness * 2.5;
  float glowShape = 1.0 - smoothstep(lineThickness, glow, lineDist);
  float distFromCenter = abs(st.y - 0.5) / 0.5;
  float intensity = 0.4 + (1.0 - distFromCenter) * 0.8;
  float lineIntensity = lineShape * intensity;
  float centerGlow = exp(-abs(st.y - 0.5) * 3.5) * 0.3;
  float highlight = snoise(st * 2.5 + t * 0.4) * 0.5 + 0.5;
  float highlightMod = mix(0.7, 1.3, highlight);
  vec3 bgColor = mix(u_troughColor * 0.9, u_troughColor * 1.1, st.y);
  vec3 lineColor = mix(u_highlightColor * 0.85, u_highlightColor * 1.15, lineIndex / lineCount);
  lineColor = mix(lineColor, u_lineColor, 0.25 * highlightMod);
  vec3 finalColor = mix(bgColor, lineColor * 0.3, glowShape * 0.4);
  finalColor = mix(finalColor, lineColor, lineIntensity);
  finalColor += u_highlightColor * centerGlow;
  float cursorGlow = exp(-distance(st, vec2(0.5)) * 3.0) * 0.08;
  finalColor += u_highlightColor * cursorGlow;
  finalColor += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
  float vignette = 1.0 - smoothstep(0.4, 1.4, length(st - vec2(0.5)));
  finalColor *= 0.75 + vignette * 0.25;
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function useWaveShader(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const mouseTarget = useRef({ x: 0.5, y: 0.5 });
  const mouseCurrent = useRef({ x: 0.5, y: 0.5 });
  const rafId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'aVertexPosition');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uWaveSpeed = gl.getUniformLocation(program, 'u_waveSpeed');
    const uWaveAmplitude = gl.getUniformLocation(program, 'u_waveAmplitude');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uHighlightColor = gl.getUniformLocation(program, 'u_highlightColor');
    const uTroughColor = gl.getUniformLocation(program, 'u_troughColor');
    const uLineColor = gl.getUniformLocation(program, 'u_lineColor');

    gl.uniform1f(uWaveSpeed, 0.8);
    gl.uniform1f(uWaveAmplitude, 0.6);
    gl.uniform3f(uHighlightColor, 0.957, 0.941, 0.922);
    gl.uniform3f(uTroughColor, 0.110, 0.118, 0.129);
    gl.uniform3f(uLineColor, 0.0, 0.337, 0.780);

    const handleMouseMove = (e: MouseEvent) => {
      mouseTarget.current.x = e.clientX / window.innerWidth;
      mouseTarget.current.y = 1.0 - e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      const dpr = window.devicePixelRatio > 1 && window.innerWidth >= 768 ? 1.0 : 0.7;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const render = (time: number) => {
      mouseCurrent.current.x += (mouseTarget.current.x - mouseCurrent.current.x) * 0.05;
      mouseCurrent.current.y += (mouseTarget.current.y - mouseCurrent.current.y) * 0.05;

      gl.uniform1f(uTime, time * 0.001);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseCurrent.current.x, mouseCurrent.current.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafId.current = requestAnimationFrame(render);
    };

    rafId.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [canvasRef]);
}
