export function initializeBloomEffect(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
	// Shader sources
	const vertexShaderSource = `
        attribute vec3 a_position;
        attribute vec2 a_texcoord;
        varying vec2 v_texcoord;
        void main() {
            v_texcoord = a_texcoord;
            gl_Position = vec4(a_position, 1.0);
        }
    `;

	const sceneFragmentShaderSource = `
        precision mediump float;
        varying vec2 v_texcoord;
        uniform sampler2D u_texture;
        void main() {
            gl_FragColor = texture2D(u_texture, v_texcoord);
        }
    `;

	const radius = 50;
	const strength = '0.08';

	const blurFragmentShaderSource = `
        precision mediump float;
        varying vec2 v_texcoord;
        uniform sampler2D u_texture;
        uniform vec2 u_resolution;
        uniform vec2 u_direction;

		vec3 mapToAsymptote(vec3 v, float max, float steepness) {
    		return max - max / exp(steepness * v);
		}
		vec3 overflowColor(vec3 color, float treshold) {
			vec3 overflow = max(vec3(0.0), color - treshold);
			return mix(color, vec3(1.0), min(1.0, length(overflow)));
	}

        void main() {
            vec2 tex_offset = u_direction / u_resolution; // size of a single texel
            vec4 result = vec4(0.0);
			float inverseRadius = 1.0 / ${radius}.0;
			
            for (int i = -${radius}; i <= ${radius}; i++) {
                vec2 offset = float(i) * tex_offset;
				float strength = 1.0 - abs(float(i)) * inverseRadius;
                result += texture2D(u_texture, v_texcoord + offset) * strength;
            }
			result.rgb = mapToAsymptote(result.rgb, 1.0, ${strength});
			result.rgb = overflowColor(result.rgb, 0.5);
			result.a = 1.0;

			gl_FragColor = result;

        }
    `;

	const combineFragmentShaderSource = `
        precision mediump float;
        varying vec2 v_texcoord;
        uniform sampler2D u_scene;
        uniform sampler2D u_bloom;
        void main() {
            vec4 scene = texture2D(u_scene, v_texcoord);
			scene.rgb = vec3(scene.r + scene.g + scene.b); // grayscale the scene (and make it brighter)
            vec4 bloom = texture2D(u_bloom, v_texcoord);
            gl_FragColor =  scene + bloom; // Additive blending
        }
    `;

	// Shader compilation
	function createShader(gl: WebGL2RenderingContext, type: GLenum, source: string) {
		const shader = gl.createShader(type)!;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error(gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	function createProgram(
		gl: WebGL2RenderingContext,
		vertexShader: WebGLShader,
		fragmentShader: WebGLShader
	) {
		const program = gl.createProgram()!;
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error(gl.getProgramInfoLog(program));
			gl.deleteProgram(program);
			throw new Error('Program link error');
		}
		return program;
	}

	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)!;
	const sceneFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, sceneFragmentShaderSource)!;
	const blurFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, blurFragmentShaderSource)!;
	const combineFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, combineFragmentShaderSource)!;

	const sceneProgram = createProgram(gl, vertexShader, sceneFragmentShader);
	const blurProgram = createProgram(gl, vertexShader, blurFragmentShader);
	const combineProgram = createProgram(gl, vertexShader, combineFragmentShader);

	// Attribute and uniform locations
	const positionLocation = gl.getAttribLocation(sceneProgram, 'a_position');
	const texcoordLocation = gl.getAttribLocation(sceneProgram, 'a_texcoord');

	const resolutionLocation = gl.getUniformLocation(blurProgram, 'u_resolution');
	const directionLocation = gl.getUniformLocation(blurProgram, 'u_direction');

	const sceneTextureLocation = gl.getUniformLocation(combineProgram, 'u_scene');
	const bloomTextureLocation = gl.getUniformLocation(combineProgram, 'u_bloom');

	// Buffers
	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
		gl.STATIC_DRAW
	);

	const texcoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
		gl.STATIC_DRAW
	);

	// Framebuffers and textures
	function createFramebufferTexture(
		gl: WebGL2RenderingContext,
		width: number,
		height: number,
		type: GLenum = gl.UNSIGNED_BYTE
	) {
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, type, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		const framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		return { framebuffer, texture };
	}

	const sceneFBO = createFramebufferTexture(gl, canvas.width, canvas.height);
	const bloomFBO1 = createFramebufferTexture(gl, canvas.width, canvas.height);
	const bloomFBO2 = createFramebufferTexture(gl, canvas.width, canvas.height);

	// Function to draw a fullscreen quad
	function drawQuad(gl: WebGL2RenderingContext, program: WebGLProgram) {
		gl.useProgram(program);

		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
		gl.enableVertexAttribArray(texcoordLocation);
		gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	// Function to render the scene
	function renderScene(renderFunction: () => any) {
		// Bind the framebuffer to render the scene into a texture
		gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO.framebuffer);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Call the user-defined scene render function
		renderFunction();

		// Unbind the framebuffer to avoid feedback loop
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	// Function to apply blur
	function applyBlur(inputFBO: any, outputFBO: any, direction: number[], clear = true) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.framebuffer);
		if (clear) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(blurProgram);
		gl.bindTexture(gl.TEXTURE_2D, inputFBO.texture);
		gl.activeTexture(gl.TEXTURE0);

		gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
		gl.uniform2f(directionLocation, direction[0], direction[1]);
		drawQuad(gl, blurProgram);
	}

	// Function to combine the scene with the bloom
	function combineSceneAndBloom() {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.useProgram(combineProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sceneFBO.texture);
		gl.uniform1i(sceneTextureLocation, 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, bloomFBO2.texture);
		gl.uniform1i(bloomTextureLocation, 1);

		drawQuad(gl, combineProgram);
	}

	// Return a function that can be used in the render loop
	return function (renderFunction: () => any) {
		// 1. Render the scene to a texture
		renderScene(renderFunction);

		// 2. Apply horizontal blur
		applyBlur(sceneFBO, bloomFBO1, [1.0, 0.0]);

		// 3. Apply vertical blur
		applyBlur(bloomFBO1, bloomFBO2, [0.0, 1.0]);

		// 4. Combine the scene and the bloom
		combineSceneAndBloom();
	};
}
