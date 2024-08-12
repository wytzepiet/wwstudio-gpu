#version 300 es
precision highp float;

in vec3 a_oldPosition;  
in vec3 a_newPosition;  

uniform float u_cellSize;
uniform vec3 u_gridSize;

flat out int v_gridIndex;

int gridIndex(vec3 position) {
    vec3 gridPosition = floor(position / u_cellSize);
    return int(gridPosition.x + gridPosition.y * u_gridSize.x + gridPosition.z * u_gridSize.x * u_gridSize.y);
}

void main() {
    int oldGridIndex = gridIndex(a_oldPosition);
    int newGridIndex = gridIndex(a_newPosition);
    if(newGridIndex != oldGridIndex) {
        v_gridIndex = newGridIndex;
        gl_Position = vec4(a_newPosition, 1.0);
    } else {

    }
}
