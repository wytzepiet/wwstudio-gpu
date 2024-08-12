#version 300 es
precision highp float;

in float u_cellSize;
in vec3 u_gridSize;


out vec4 outColor;



void main() {
    // Output a constant value to increment the count in the texture
    outColor = vec4(1.0, 0.0, 0.0, 1.0); // Increment red channel by 1
}