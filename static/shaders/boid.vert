#version 300 es
precision mediump float;
precision mediump sampler3D;

in vec3 a_position;
in vec3 a_velocity;

uniform mat4 u_projectionMatrix;
uniform mat4 u_viewMatrix;
uniform float u_deltaTime;
uniform vec3 u_canvasSize;
uniform vec3 u_mouse;
uniform float u_maxSpeed;
uniform float u_pointSize;
uniform sampler3D u_grid;
uniform vec3 u_gridSize;
uniform float u_cellSize;

out vec3 v_position;
out vec3 v_velocity;
flat out ivec2 v_gridIndex;
out float v_depth;

int gridIndex(vec3 position) {
    vec3 gridPosition = floor(position / u_cellSize);
    return int(gridPosition.x + gridPosition.y * u_gridSize.x + gridPosition.z * u_gridSize.x * u_gridSize.y);
}

void main() {

    // Move toward mouse
    vec3 direction = u_mouse - a_position;

    vec3 velocity = a_velocity + normalize(direction);

    velocity = normalize(velocity) * u_maxSpeed;

    // Update logic: move position by velocity
    vec3 newPosition = a_position + velocity * u_deltaTime;

    int oldGridIndex = gridIndex(a_position);
    int newGridIndex = gridIndex(newPosition);
    if(newGridIndex != oldGridIndex) {
        v_gridIndex = ivec2(newGridIndex, oldGridIndex);
    } else {
        // v_gridIndex = ivec2(-1, -1);
    }




    // Wrap around a defined space. position goes from -canvasSize/2 to canvasSize/2
    // new_position.x = mod(new_position.x + u_canvasSize.x / 2., u_canvasSize.x) - u_canvasSize.x / 2.;

    // Pass updated positions and velocities to the transform feedback
    v_position = newPosition;
    v_velocity = velocity;

    // Convert position to clip space using projection and view matrices
    vec4 clipSpace = u_projectionMatrix * u_viewMatrix * vec4(newPosition, 1.0);

    v_depth = newPosition.z / u_canvasSize.z + 0.5;
    
    gl_Position = clipSpace;
    gl_PointSize = 1.0 / clipSpace.w * 1000.0;
}