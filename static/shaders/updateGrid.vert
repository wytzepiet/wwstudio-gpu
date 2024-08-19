#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_velocity;

uniform vec3 u_gridSize;
uniform vec3 u_canvasSize;
uniform float u_boidsPerCell;
uniform vec2 u_gridTextureSize;

out vec3 v_position;
out vec3 v_velocity;

void main() {
    vec3 normalPos = a_position / u_canvasSize + 0.5;
    vec3 gridPos = normalPos * u_gridSize;
    float count = mod(float(gl_VertexID), u_boidsPerCell);

    vec2 texCoord = vec2(gridPos.x * gridPos.y, gridPos.z * count) / u_gridTextureSize;

    v_position = a_position;
    v_velocity = a_velocity;

    gl_PointSize = 20.0;
    gl_Position = vec4(texCoord, 1.0, 1.0);
    
}
