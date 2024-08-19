<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	import { createBuffer, initProgram } from './weglUtils';
	import { createRadialGradientTexture } from './createRadialGradient';
	import { initializeBloomEffect } from './bloomPass';

	let canvas: HTMLCanvasElement;

	const NUM_BOIDS = 100000;

	onMount(async () => {
		const gl = canvas.getContext('webgl2')!;
		if (!gl) {
			alert('WebGL2 not supported');
			return;
		}

		const boidsProgram = await initProgram(gl, {
			vertexPath: '/shaders/boid.vert',
			fragmentPath: '/shaders/boid.frag',
			transformFeedbackVaryings: ['v_position', 'v_velocity']
		});

		gl.useProgram(boidsProgram);

		const updateGridProgram = await initProgram(gl, {
			vertexPath: '/shaders/updateGrid.vert',
			fragmentPath: '/shaders/updateGrid.frag'
		});

		const uLoc = (name: string) => gl.getUniformLocation(boidsProgram, name)!;

		gl.uniform1f(uLoc('u_pointSize'), 1.0);
		gl.uniform1f(uLoc('u_maxSpeed'), 1.8);
		gl.uniform1f(uLoc('u_maxForce'), 0.04);

		// Set up perspective matrix
		const near = 1;
		const far = 1000;

		const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, near, far);

		function resize() {
			if (!canvas) return window.removeEventListener('resize', resize);
			canvas.width = canvas.clientWidth;
			canvas.height = canvas.clientHeight;
			gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
			gl.uniform3f(uLoc('u_canvasSize'), canvas.width, canvas.height, far - near);

			camera.aspect = canvas.width / canvas.height;
			camera.position.set(0, 0, -500);
			camera.lookAt(0, 0, 0);
			camera.updateMatrixWorld();
			camera.updateProjectionMatrix();

			gl.uniformMatrix4fv(uLoc('u_projectionMatrix'), false, camera.projectionMatrix.toArray());
			gl.uniformMatrix4fv(uLoc('u_viewMatrix'), false, camera.matrix.toArray());
		}

		resize();
		window.addEventListener('resize', resize);

		const depth = -500;
		const mouse = new THREE.Vector3();

		function moveMouse(e: MouseEvent) {
			mouse.x = (e.clientX / canvas.width) * 2 - 1;
			mouse.y = 1 - (e.clientY / canvas.height) * 2;

			const a = (far + near) / (far - near);
			const b = (2 * far * near) / (far - near);
			mouse.z = (a * depth + b) / depth;

			mouse.unproject(camera);

			gl.useProgram(boidsProgram);
			gl.uniform3f(uLoc('u_mouse'), mouse.x, mouse.y, mouse.z);
		}

		moveMouse({ clientX: 0, clientY: 0 } as MouseEvent);
		window.addEventListener('mousemove', moveMouse);

		const viewDist = 50;
		const cellSize = viewDist;
		const boidsPerCell = 8;
		const canvasSize = new THREE.Vector3(canvas.width, canvas.height, 1000);
		const gridSize = canvasSize.clone().divideScalar(cellSize).ceil();
		const gridTextureSize = new THREE.Vector2(gridSize.x * gridSize.y, gridSize.z * boidsPerCell);

		console.log(gridSize);

		gl.uniform1f(uLoc('u_viewDist'), viewDist);
		// gl.uniform1f(gl.getUniformLocation(updateGridProgram, 'u_cellSize'), cellSize);

		gl.useProgram(updateGridProgram);

		gl.uniform3f(gl.getUniformLocation(updateGridProgram, 'u_gridSize'), ...gridSize.toArray());
		gl.uniform1f(gl.getUniformLocation(updateGridProgram, 'u_boidsPerCell'), boidsPerCell);
		gl.uniform2f(
			gl.getUniformLocation(updateGridProgram, 'u_gridTextureSize'),
			...gridTextureSize.toArray()
		);

		function createGridTexture() {
			const [width, height] = gridTextureSize.toArray();
			const data = new Float32Array(width * height * 3).map(Math.random);

			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

			return texture;
		}

		const posGridTex = createGridTexture();
		const velGridTex = createGridTexture();

		const gridFrameBuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, gridFrameBuffer);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, posGridTex, 0);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, velGridTex, 0);

		// Set the list of draw buffers
		// gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

		// Check framebuffer status
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) console.error('Framebuffer is not complete:', status);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		const random = (scale: number) => (Math.random() - 0.5) * scale;
		const boidsArray = () => new Float32Array(NUM_BOIDS * 3);

		// Initialize boid data
		const positions = boidsArray().map((_, i) => random(canvasSize.toArray()[i % 3]));
		const velocities = boidsArray().map(() => random(10));

		const positionBuffers = [createBuffer(gl, positions), createBuffer(gl, positions)];
		const velocityBuffers = [createBuffer(gl, velocities), createBuffer(gl, velocities)];

		gl.enableVertexAttribArray(0);
		gl.enableVertexAttribArray(1);

		const renderWithBloom = initializeBloomEffect(gl, { x: canvas.width, y: canvas.height });

		// Create and bind the radial gradient texture
		const gradientTexture = createRadialGradientTexture(gl, 200)!;
		const gradientTextureLoc = gl.getUniformLocation(boidsProgram, 'u_gradientTexture');

		function render() {
			gl.blendFunc(gl.ONE, gl.ONE);

			gl.useProgram(updateGridProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[0]);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(0);
			gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffers[0]);
			gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(1);

			gl.bindFramebuffer(gl.FRAMEBUFFER, gridFrameBuffer);

			gl.drawArrays(gl.POINTS, 0, NUM_BOIDS);

			// //read the framebuffer
			// const positions = new Uint8Array(gridTextureSize.x * gridTextureSize.y * 32);
			// gl.readPixels(
			// 	0,
			// 	0,
			// 	gridTextureSize.x,
			// 	gridTextureSize.y,
			// 	gl.RGBA,
			// 	gl.UNSIGNED_BYTE,
			// 	positions
			// );

			// console.log(positions);
			// gl.bindFramebuffer(gl.FRAMEBUFFER, null);

			gl.useProgram(boidsProgram);

			// Update VAO bindings for next frame
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[0]);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffers[0]);
			gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, positionBuffers[1]);
			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, velocityBuffers[1]);

			// Bind the gradient texture to texture unit 0
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
			gl.uniform1i(gradientTextureLoc, 0);

			renderWithBloom(() => {
				gl.useProgram(boidsProgram);
				gl.beginTransformFeedback(gl.POINTS);
				gl.drawArrays(gl.POINTS, 0, NUM_BOIDS);
				gl.endTransformFeedback();
			});

			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);

			// read the position buffer and console log the first position
			// const positions = new Float32Array(NUM_BOIDS * 3);
			// gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[1]);
			// gl.getBufferSubData(gl.ARRAY_BUFFER, 0, positions);
			// console.log(Array.from(positions.slice(0, 3)).map((x) => x.toFixed(1)));

			positionBuffers.reverse();
			velocityBuffers.reverse();

			requestAnimationFrame(render);
		}

		render();
	});
</script>

<canvas bind:this={canvas} class="w-full h-screen"></canvas>
