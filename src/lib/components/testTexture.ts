export function renderTextureFullScreen(
	webglTexture: (gl: WebGL2RenderingContext) => WebGLTexture,
	textureWidth: number,
	textureHeight: number
): void {
	// Create a new fullscreen canvas
	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	canvas.style.position = 'absolute';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	// Create WebGL context
	const gl = canvas.getContext('webgl2');
	if (!gl) {
		alert('WebGL2 is not supported');
		return;
	}

	// Vertex shader source
	const vertexShaderSource = `#version 300 es
        precision mediump float;

        void main() {
            // Set the point position to the center of the screen
            gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
            gl_PointSize = float(${Math.max(canvas.width, canvas.height)});
        }
    `;

	// Fragment shader source
	const fragmentShaderSource = `#version 300 es
        precision mediump float;

        uniform sampler2D u_texture;

        out vec4 fragColor;

        void main() {
            // Use gl_PointCoord to sample the texture
            fragColor = texture(u_texture, gl_PointCoord);
        }
    `;

	// Function to create and compile a shader
	function createShader(
		gl: WebGL2RenderingContext,
		type: GLenum,
		source: string
	): WebGLShader | null {
		const shader = gl.createShader(type);
		if (!shader) {
			console.error('Unable to create shader');
			return null;
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error(gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	// Create shaders
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

	if (!vertexShader || !fragmentShader) {
		return;
	}

	// Create shader program
	const program = gl.createProgram();
	if (!program) {
		console.error('Unable to create program');
		return;
	}

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return;
	}

	// Look up the texture uniform location
	const textureLocation = gl.getUniformLocation(program, 'u_texture');

	// Configure the viewport
	gl.viewport(0, 0, canvas.width, canvas.height);

	// Clear the canvas with a blue color for clarity
	gl.clearColor(0.0, 0.0, 1.0, 1.0); // RGBA: Blue background
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Use the shader program
	gl.useProgram(program);

	// Bind the texture and set the uniform
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, webglTexture(gl));
	gl.uniform1i(textureLocation, 0);

	// Enable blending
	gl.enable(gl.BLEND);

	// Set the blend function for transparency
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	// Draw a single point covering the entire screen
	gl.drawArrays(gl.POINTS, 0, 1);
}
