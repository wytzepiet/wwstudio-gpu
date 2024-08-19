export function createRadialGradientTexture(
	gl: WebGL2RenderingContext,
	size: number
): WebGLTexture | null {
	// Create an offscreen canvas to draw the gradient
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		console.error('Failed to create 2D context');
		return null;
	}

	const r = size / 2;
	// Create radial gradient
	const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);

	// Add color stops (white to transparent)
	gradient.addColorStop(0.9, 'rgba(255, 255, 255, 1.0)'); // Fully white at the center
	gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)'); // Fully transparent at the edges

	// Fill the canvas with the gradient
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);

	// Create a WebGL texture and bind it
	const texture = gl.createTexture();
	if (!texture) {
		console.error('Failed to create texture');
		return null;
	}

	gl.bindTexture(gl.TEXTURE_2D, texture);

	// Upload the canvas content as a texture
	gl.texImage2D(
		gl.TEXTURE_2D,
		0, // Level of detail (0 is base level)
		gl.RGBA, // Internal format
		gl.RGBA, // Format of the pixel data
		gl.UNSIGNED_BYTE, // Type of the pixel data
		canvas // The actual canvas element
	);

	// Set texture parameters
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	// Unbind the texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return texture;
}

export function createRedTexture(
	gl: WebGL2RenderingContext,
	width: number,
	height: number
): WebGLTexture | null {
	// Create a new texture
	const texture = gl.createTexture();
	if (!texture) {
		console.error('Failed to create texture');
		return null;
	}

	// Bind the texture so we can work with it
	gl.bindTexture(gl.TEXTURE_2D, texture);

	// Create a Uint8Array with red color (RGBA)
	const redColor = new Uint8Array([255, 0, 0, 255]); // Fully red with full opacity

	// Create an array to fill the entire texture
	const redPixels = new Uint8Array(width * height * 4);
	for (let i = 0; i < redPixels.length; i += 4) {
		redPixels.set(redColor, i);
	}

	// Upload the texture to the GPU
	gl.texImage2D(
		gl.TEXTURE_2D,
		0, // Level of detail (0 is base level)
		gl.RGBA, // Internal format
		width, // Width of the texture
		height, // Height of the texture
		0, // Border (must be 0)
		gl.RGBA, // Format of the pixel data
		gl.UNSIGNED_BYTE, // Type of the pixel data
		redPixels // The actual pixel data
	);

	// Set texture parameters
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	// Unbind the texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return texture;
}
