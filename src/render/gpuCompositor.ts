interface GpuState {
  gl: WebGL2RenderingContext
  program: WebGLProgram
  texture: WebGLTexture
  vao: WebGLVertexArrayObject
}

const states = new WeakMap<HTMLCanvasElement, GpuState>()

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const item = gl.createShader(type)
  if (!item) throw new Error('WebGL shader 생성 실패')
  gl.shaderSource(item, source)
  gl.compileShader(item)
  if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(item) || 'WebGL shader compile error'
    gl.deleteShader(item)
    throw new Error(message)
  }
  return item
}

function createState(canvas: HTMLCanvasElement): GpuState | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  if (!gl) return null

  const vertex = shader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec2 a_position;
    in vec2 a_uv;
    out vec2 v_uv;
    void main() {
      v_uv = a_uv;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `)
  const fragment = shader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    uniform sampler2D u_texture;
    in vec2 v_uv;
    out vec4 outColor;
    void main() {
      outColor = texture(u_texture, v_uv);
    }
  `)
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null

  const vao = gl.createVertexArray()
  const buffer = gl.createBuffer()
  const texture = gl.createTexture()
  if (!vao || !buffer || !texture) return null

  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1, 0,1,
     1,-1, 1,1,
    -1, 1, 0,0,
    -1, 1, 0,0,
     1,-1, 1,1,
     1, 1, 1,0,
  ]), gl.STATIC_DRAW)

  const pos = gl.getAttribLocation(program, 'a_position')
  const uv = gl.getAttribLocation(program, 'a_uv')
  gl.enableVertexAttribArray(pos)
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(uv)
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8)

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  return { gl, program, texture, vao }
}

export function canUseGpuCompositor() {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}

export function presentCanvasWithGpu(target: HTMLCanvasElement, source: HTMLCanvasElement) {
  let state = states.get(target)
  if (!state) {
    state = createState(target) ?? undefined
    if (!state) return false
    states.set(target, state)
  }

  const { gl, program, texture, vao } = state
  if (target.width !== source.width) target.width = source.width
  if (target.height !== source.height) target.height = source.height
  gl.viewport(0, 0, target.width, target.height)
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.BLEND)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(program)
  gl.bindVertexArray(vao)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  const location = gl.getUniformLocation(program, 'u_texture')
  gl.uniform1i(location, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  return true
}
