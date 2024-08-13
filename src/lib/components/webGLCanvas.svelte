<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import createRegl from 'regl';
	import { initProgram } from './weglUtils';
	import { initializeBloomEffect } from './bloomPass';
	import { createRadialGradientTexture, createRedTexture } from './createRadialGradient';
	import { renderTextureFullScreen } from './testTexture';

	let canvas: HTMLCanvasElement;
	let gl: WebGL2RenderingContext;

	const NUM_BOIDS = 10000;

	onMount(async () => {
		gl = canvas.getContext('webgl2')!;
		if (!gl) {
			alert('WebGL2 not supported');
			return;
		}

		const regl = createRegl({ gl });

		const boidsProgram = await initProgram(gl, {
			vertexPath: '/shaders/boid.vert',
			fragmentPath: '/shaders/boid.frag',
			transformFeedbackVaryings: ['v_position', 'v_velocity', 'v_gridIndex']
		});
		gl.useProgram(boidsProgram);

		const updateGridProgram = await initProgram(gl, {
			vertexPath: '/shaders/updateGrid.vert',
			fragmentPath: '/shaders/updateGrid.frag',
			transformFeedbackVaryings: ['v_gridIndex']
		});

		const uLoc = (name: string) => gl.getUniformLocation(boidsProgram, name)!;

		gl.uniform1f(uLoc('u_pointSize'), 1.5);
		gl.uniform1f(uLoc('u_maxSpeed'), 50);

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

		console.log(gridSize);

		gl.uniform1f(uLoc('u_viewDist'), viewDist);
		gl.uniform1f(uLoc('u_cellSize'), cellSize);
		gl.uniform3f(uLoc('u_gridSize'), ...gridSize.toArray());

		const numbersPerCell = boidsPerCell * 6;

		const numCells = gridSize.x * gridSize.y * gridSize.z;

		const grid = Array(numCells * numbersPerCell).fill(-1);
		const gridPointers = Array(numCells).fill(0);
		const boidIndexGrid = Array(numCells * boidsPerCell).fill(-1);
		const boidPointers = Array(NUM_BOIDS).fill(0);

		const randomVec3 = () => new THREE.Vector3(...[0, 0, 0].map(() => Math.random() - 0.5));

		function putInGrid(gridIndex: number, boidIndex: number, pos: number[], vel: number[]) {
			const pointer = gridIndex * numbersPerCell + gridPointers[gridIndex] * 6;
			boidPointers[boidIndex] = pointer;

			[grid[pointer], grid[pointer + 1], grid[pointer + 2]] = pos;
			[grid[pointer + 3], grid[pointer + 4], grid[pointer + 5]] = vel;

			gridPointers[gridIndex]++;
			if (gridPointers[gridIndex] >= boidsPerCell) gridPointers[gridIndex] = 0;
		}

		function removeFromGrid(i: number, boidIndex: number) {
			const boidPointer = boidPointers[boidIndex];
			const gridPointer = i + gridPointers[i] * numbersPerCell;

			grid[boidPointer] = -1;

			if (boidPointer === gridPointer) return;
			if (grid[gridPointer] === -1) return;

			for (let i = 0; i < 6; i++) {
				grid[boidPointer + i] = grid[gridPointer + i];
			}

			boidPointers[grid[gridPointer]] = boidPointer;
		}

		// Initialize boid data
		const positions = new Float32Array(NUM_BOIDS * 3);
		const velocities = new Float32Array(NUM_BOIDS * 3);
		const gridIndeces = new Int32Array(NUM_BOIDS * 2);

		for (let i = 0; i < NUM_BOIDS; i++) {
			const pos = randomVec3().multiply(canvasSize);
			const vel = randomVec3().multiplyScalar(10);
			const gridPos = pos.clone().divideScalar(cellSize).floor();

			[positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]] = pos.toArray();
			[velocities[i * 3], velocities[i * 3 + 1], velocities[i * 3 + 2]] = vel.toArray();

			const gridIndex = gridPos.x * gridSize.y * gridSize.z + gridPos.y * gridSize.z + gridPos.z;
			putInGrid(gridIndex, i, pos.toArray(), vel.toArray());
		}

		// set the texture to the uniform
		gl.uniform1i(gl.getUniformLocation(boidsProgram, 'u_grid'), 0);

		const createBuffer = (data: AllowSharedBufferSource) => {
			const buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			return buffer;
		};

		const positionBuffers = [createBuffer(positions), createBuffer(positions)];
		const velocityBuffers = [createBuffer(velocities), createBuffer(velocities)];
		const gridIndexBuffers = [createBuffer(gridIndeces), createBuffer(gridIndeces)];

		const positionLoc = gl.getAttribLocation(boidsProgram, 'a_position');
		gl.enableVertexAttribArray(positionLoc);

		const velocityLoc = gl.getAttribLocation(boidsProgram, 'a_velocity');
		gl.enableVertexAttribArray(velocityLoc);

		// Create and bind the radial gradient texture
		const gradientTexture = createRadialGradientTexture(gl, 200)!;
		const gradientTextureLoc = gl.getUniformLocation(boidsProgram, 'u_gradientTexture');
		// const uGradientTextureLocation = gl.getUniformLocation(boidsProgram, 'u_gradientTexture');

		// renderTextureFullScreen((gl) => createRadialGradientTexture(gl, 200)!, 200, 200);

		const renderBloomPass = initializeBloomEffect(gl, canvas);

		let lastTime = 0;
		let lastFps = 0;

		// Enable blending
		gl.enable(gl.BLEND);

		// Set the blend function for transparency
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		regl.frame((context) => {
			regl.clear({ color: [0, 0, 0, 0], depth: 1 });

			gl.useProgram(boidsProgram);

			gl.uniform1f(uLoc('u_deltaTime'), context.time - lastTime);

			let timeToOutput = false;
			let fps = 0;

			if (context.time - lastFps > 1) {
				fps = 1 / (context.time - lastTime);
				timeToOutput = true;
				lastFps = context.time;
			}

			if (timeToOutput) console.log(fps);

			lastTime = context.time;

			// Update VAO bindings for next frame
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[0]);
			gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffers[0]);
			gl.vertexAttribPointer(velocityLoc, 3, gl.FLOAT, false, 0, 0);

			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, positionBuffers[1]);
			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, velocityBuffers[1]);
			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, gridIndexBuffers[1]);

			renderBloomPass(() => {
				gl.useProgram(boidsProgram);

				// Bind the gradient texture to texture unit 0
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, gradientTexture);

				// Set the uniform for the sampler in your shader
				gl.uniform1i(gradientTextureLoc, 0);

				// Ensure no texture is bound before drawing

				gl.beginTransformFeedback(gl.POINTS);

				// gl.bindTexture(gl.TEXTURE_2D, null);
				gl.drawArrays(gl.POINTS, 0, NUM_BOIDS);

				gl.endTransformFeedback();
			});

			// gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
			// gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
			// gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, null);

			positionBuffers.reverse();
			velocityBuffers.reverse();
			gridIndexBuffers.reverse();

			// //read the output from the grid index buffer
			// gl.bindBuffer(gl.ARRAY_BUFFER, gridIndexBuffers[1]);
			// gl.getBufferSubData(gl.ARRAY_BUFFER, 0, gridIndeces);

			// gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[1]);
			// gl.getBufferSubData(gl.ARRAY_BUFFER, 0, positions);

			// gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffers[1]);
			// gl.getBufferSubData(gl.ARRAY_BUFFER, 0, velocities);

			// let changed = 0;

			// for (let i = 0; i < NUM_BOIDS; i++) {
			// 	const gridIndex = gridIndeces[i * 2];
			// 	if (gridIndex === 0) continue;

			// 	changed++;
			// 	removeFromGrid(gridIndeces[i * 2] + 1, i);
			// 	putInGrid(
			// 		gridIndex,
			// 		i,
			// 		[positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
			// 		[velocities[i * 3], velocities[i * 3 + 1], velocities[i * 3 + 2]]
			// 	);
			// }

			// if (timeToOutput) console.log(changed);
			// console.log(gridIndeces);

			// console.log(changed);
			// gridTexture({ data: grid });
		});
	});
</script>

<canvas bind:this={canvas} class="w-full h-screen"></canvas>
