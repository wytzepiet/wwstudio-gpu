<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { createBuffer, initProgram } from '../utils/webgl/webglUtils';
	import { createRadialGradientTexture } from '../utils/webgl/createRadialGradient';
	import { initializeBloomEffect } from '../utils/webgl/bloomPass';
	import { scrollSmooth } from '$lib/utils/scrollSmooth';
	import { timeout } from '$lib/utils/generalUtils';

	const props: { delay: number } = $props();

	let canvas: HTMLCanvasElement;

	const NUM_BOIDS = 20000;

	onMount(async () => {
		const gl = canvas.getContext('webgl2', { alpha: true })!;
		if (!gl) return alert('WebGL2 not supported');

		const varyings = gl.getParameter(gl.MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS);
		if (varyings < 4) return console.error('Need at least 4 transform feedback varyings');

		const boidsProgram = await initProgram(gl, {
			vertexPath: '/shaders/boid.vert',
			fragmentPath: '/shaders/boid.frag',
			transformFeedbackVaryings: ['v_position', 'v_velocity', 'v_deviationVel']
		});

		gl.useProgram(boidsProgram);

		const updateGridProgram = await initProgram(gl, {
			vertexPath: '/shaders/updateGrid.vert',
			fragmentPath: '/shaders/updateGrid.frag'
		});

		const uLoc = (name: string) => gl.getUniformLocation(boidsProgram, name)!;

		const hexToRgb = (hex: string) =>
			[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

		gl.uniform1f(uLoc('u_pointSize'), 2.0);
		gl.uniform1f(uLoc('u_maxSpeed'), 2.4);
		gl.uniform1f(uLoc('u_maxForce'), 0.13);
		// gl.uniform3f(uLoc('u_color1'), ...hexToRgb('#49a25f'));
		// gl.uniform3f(uLoc('u_color2'), ...hexToRgb('#34094b'));

		//trippy iowaska colors
		// gl.uniform3f(uLoc('u_color1'), ...hexToRgb('#c02425'));
		// gl.uniform3f(uLoc('u_color2'), ...hexToRgb('#f0cb35'));

		//another trippy one
		// gl.uniform3f(uLoc('u_color1'), ...hexToRgb('#ff6a00'));
		// gl.uniform3f(uLoc('u_color2'), ...hexToRgb('#ee0979'));

		//white to pink to purple
		// gl.uniform3f(uLoc('u_color1'), ...hexToRgb('#fdeff9'));
		// gl.uniform3f(uLoc('u_color2'), ...hexToRgb('#03001e'));

		//gold to blue greeny
		// gl.uniform3f(uLoc('u_color1'), ...hexToRgb('#60dcbb'));
		// gl.uniform3f(uLoc('u_color2'), ...hexToRgb('#3f083f'));

		//gold red
		gl.uniform3f(uLoc('u_color1'), ...hexToRgb('#b47a2d'));
		gl.uniform3f(uLoc('u_color2'), ...hexToRgb('#5b0b0b'));

		// gl.uniform3f(uLoc('u_color1'), ...hexToRgb('#a4c3c5'));
		// gl.uniform3f(uLoc('u_color2'), ...hexToRgb('#022c19'));

		const cameraDist = 1200;
		const near = 1;
		const far = cameraDist * 2;

		const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, near, far);

		gl.uniform1f(uLoc('u_far'), far);
		gl.uniform1f(uLoc('u_near'), near);

		function resize() {
			if (!canvas) return window.removeEventListener('resize', resize);
			gl.useProgram(boidsProgram);
			canvas.width = canvas.clientWidth;
			canvas.height = canvas.clientHeight;
			gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
			gl.uniform3f(uLoc('u_canvasSize'), canvas.width, canvas.height, 1000);

			camera.aspect = canvas.width / canvas.height;
			// const camY = Math.sin(scrollSmooth.progress) * -cameraDist;
			// const camZ = Math.cos(scrollSmooth.progress) * -cameraDist;
			camera.position.set(0, 0, scrollSmooth.top - cameraDist);
			camera.lookAt(0, 0, 10000);

			camera.updateMatrixWorld();
			camera.updateProjectionMatrix();

			const projMat = camera.projectionMatrix.clone().toArray();
			const viewMat = camera.matrixWorld.clone().toArray();
			const invProjMat = camera.projectionMatrixInverse.clone().toArray();
			const invViewMat = camera.matrixWorldInverse.clone().toArray();

			gl.uniformMatrix4fv(uLoc('u_projectionMatrix'), false, projMat);
			gl.uniformMatrix4fv(uLoc('u_viewMatrix'), false, viewMat);
			gl.uniformMatrix4fv(uLoc('u_inverseProjectionMatrix'), false, invProjMat);
			gl.uniformMatrix4fv(uLoc('u_inverseViewMatrix'), false, invViewMat);
		}

		resize();
		window.addEventListener('resize', () => requestAnimationFrame(resize));
		scrollSmooth.subscribe(() => requestAnimationFrame(resize));

		const target = new THREE.Vector3();

		function moveTarget(x: number, y: number) {
			target.x = (x / canvas.width) * 2 - 1;
			target.y = 1 - (y / canvas.height) * 2;

			const depth = -far / 2;
			const a = (far + near) / (far - near);
			const b = (2 * far * near) / (far - near);
			target.z = (a * depth + b) / depth;

			target.unproject(camera);

			gl.useProgram(boidsProgram);
			gl.uniform3f(uLoc('u_target'), ...target.toArray());
		}

		function keepMovingTarget() {
			const random = () => Math.random() * 0.3 + 0.35;
			moveTarget(random() * window.innerWidth, random() * window.innerHeight);
			timeout(Math.random() * 2000 + 1000).then(() => keepMovingTarget());
		}

		moveTarget(window.innerWidth / 2, window.innerHeight / 2);
		timeout(1000 + props.delay).then(() => keepMovingTarget());

		const cellSize = 70;
		const viewDist = cellSize * 1.35;
		const boidsPerCell = 16;
		const canvasSize = new THREE.Vector3(canvas.width, canvas.height, 1000);
		const gridSize = canvasSize.clone().divideScalar(cellSize);
		const gridTextureSize = new THREE.Vector2(gridSize.x * gridSize.y, gridSize.z * boidsPerCell);

		gl.uniform1f(uLoc('u_viewDist'), viewDist);
		gl.uniform3f(uLoc('u_gridSize'), ...gridSize.toArray());
		gl.uniform2f(uLoc('u_gridTextureSize'), ...gridTextureSize.toArray());
		gl.uniform1f(uLoc('u_boidsPerCell'), boidsPerCell);

		gl.useProgram(updateGridProgram);

		const canvasSizeloc = gl.getUniformLocation(updateGridProgram, 'u_canvasSize');
		const gridSizeLoc = gl.getUniformLocation(updateGridProgram, 'u_gridSize');
		const gridTextureSizeLoc = gl.getUniformLocation(updateGridProgram, 'u_gridTextureSize');
		const boidsPerCellLoc = gl.getUniformLocation(updateGridProgram, 'u_boidsPerCell');

		gl.uniform3f(canvasSizeloc, ...canvasSize.toArray());
		gl.uniform3f(gridSizeLoc, ...gridSize.toArray());
		gl.uniform2f(gridTextureSizeLoc, ...gridTextureSize.toArray());
		gl.uniform1f(boidsPerCellLoc, boidsPerCell);

		const ext = gl.getExtension('EXT_color_buffer_half_float');
		if (!ext) console.error('FLOAT textures are not supported!');

		function createGridTexture() {
			const [width, height] = gridTextureSize.toArray();
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
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
		gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

		// Check framebuffer status
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) console.error('Framebuffer is not complete:', status);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		// Initialize boid data

		// positions, velocities, deviations, deviationvelocites
		const data = Array.from({ length: 3 }).map(() => new Float32Array(NUM_BOIDS * 3));
		const [positions, velocities, deviationVels] = data;

		function randomVec(): THREE.Vector3 {
			const vec = new THREE.Vector3().random().multiplyScalar(2).subScalar(1);
			return vec.length() > 1 ? randomVec() : vec;
		}

		for (let i = 0; i < NUM_BOIDS * 3; i += 3) {
			const vec = randomVec();
			velocities.set([...vec], i);
			positions.set([...vec], i);
		}

		const buffers = data.map((data) => [createBuffer(gl, data), createBuffer(gl, data)]);

		const renderWithBloom = initializeBloomEffect(gl, { x: canvas.width, y: canvas.height });

		// Create and bind the radial gradient texture
		const gradientTexture = createRadialGradientTexture(gl, 16)!;
		const gradientTextureLoc = gl.getUniformLocation(boidsProgram, 'u_gradientTexture');

		const mouse = new THREE.Vector2(canvas.height / 2, canvas.width / 2);
		const prevMouse = mouse.clone();
		let mouseSet = false;

		timeout(props.delay + 1000).then(() => {
			window.addEventListener('mousemove', (e) => {
				const x = window.innerWidth / 2 - e.clientX;
				const y = window.innerHeight / 2 - e.clientY;
				mouse.set(x, y);
				if (!mouseSet) prevMouse.set(mouse.x, mouse.y);
				mouseSet = true;
			});
		});

		// Create a renderbuffer for depth
		const depthRenderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);

		// Attach the depth renderbuffer to the framebuffer
		gl.framebufferRenderbuffer(
			gl.FRAMEBUFFER,
			gl.DEPTH_ATTACHMENT,
			gl.RENDERBUFFER,
			depthRenderbuffer
		);

		// Check framebuffer status
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
			console.error('Framebuffer is not complete');
		}

		function render() {
			gl.useProgram(updateGridProgram);
			gl.bindFramebuffer(gl.FRAMEBUFFER, gridFrameBuffer);
			gl.viewport(0, 0, gridTextureSize.x, gridTextureSize.y);

			buffers.slice(0, 2).forEach((buffer, i) => {
				gl.enableVertexAttribArray(i);
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer[0]);
				gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 0, 0);
			});

			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			gl.drawArrays(gl.POINTS, 0, NUM_BOIDS);

			gl.viewport(0, 0, canvas.width, canvas.height);

			//read the framebuffer
			// if (i % 60 === 1) {
			// 	gl.readBuffer(gl.COLOR_ATTACHMENT0);
			// 	const positions = new Float32Array(gridTextureSize.x * gridTextureSize.y * 4);
			// 	gl.readPixels(0, 0, gridTextureSize.x, gridTextureSize.y, gl.RGBA, gl.FLOAT, positions);

			// 	// count the amount of non-empty cells
			// 	const count = positions.reduce((prev, val, i) => (i % 4 == 3 ? prev + val : prev), 0);

			// 	// an array of every 4th element
			// 	const cells = positions.filter((_, i) => i % 4 === 3);

			// 	const indeces = positions
			// 		.map((val, i) => (i % 4 === 3 && val != 0 ? i : -1))
			// 		.filter((val) => val > -1);

			// 	console.log(count, indeces, positions);
			// }
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);

			renderWithBloom(() => {
				gl.useProgram(boidsProgram);

				gl.uniform2f(uLoc('u_mouse'), mouse.x, mouse.y);
				gl.uniform2f(uLoc('u_prevMouse'), prevMouse.x, prevMouse.y);
				prevMouse.set(mouse.x, mouse.y);

				buffers.forEach((buffer, i) => {
					gl.enableVertexAttribArray(i);
					gl.bindBuffer(gl.ARRAY_BUFFER, buffer[0]);
					gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 0, 0);
					gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, buffer[1]);
				});

				// Bind the gradient texture to texture unit 0
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
				gl.uniform1i(gradientTextureLoc, 0);

				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, posGridTex);
				gl.uniform1i(uLoc('u_posGridTex'), 1);

				gl.activeTexture(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, velGridTex);
				gl.uniform1i(uLoc('u_velGridTex'), 2);

				gl.clear(gl.DEPTH_BUFFER_BIT);
				gl.enable(gl.DEPTH_TEST);

				gl.enable(gl.BLEND);
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

				gl.beginTransformFeedback(gl.POINTS);
				gl.drawArrays(gl.POINTS, 0, NUM_BOIDS);
				gl.endTransformFeedback();

				gl.activeTexture(gl.TEXTURE0);

				buffers.forEach((buffer, i) => {
					gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, null);
					gl.disableVertexAttribArray(i);
					buffer.reverse();
				});
			});

			// read the position buffer and console log the first position
			// const positions = new Float32Array(NUM_BOIDS * 3);
			// gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[1]);
			// gl.getBufferSubData(gl.ARRAY_BUFFER, 0, positions);
			// console.log(Array.from(positions.slice(0, 3)).map((x) => x.toFixed(1)));

			requestAnimationFrame(render);
		}

		timeout(props.delay).then(() => requestAnimationFrame(render));
	});
</script>

<canvas bind:this={canvas} class="w-full h-screen"></canvas>
