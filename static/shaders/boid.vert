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
out vec3 rgb;

int gridIndex(vec3 position) {
    vec3 gridPosition = floor(position / u_cellSize);
    return int(gridPosition.x + gridPosition.y * u_gridSize.x + gridPosition.z * u_gridSize.x * u_gridSize.y);
}

// Function to convert LCH to Lab
vec3 lch2lab(vec3 lch) {
    float C = lch.y;
    float h = radians(lch.z);
    float a = cos(h) * C;
    float b = sin(h) * C;
    return vec3(lch.x, a, b);
}

// Function to convert Lab to XYZ
vec3 lab2xyz(vec3 lab) {
    float y = (lab.x + 16.0) / 116.0;
    float x = lab.y / 500.0 + y;
    float z = y - lab.z / 200.0;
    
    float x3 = x * x * x;
    float z3 = z * z * z;
    x = (x3 > 0.008856) ? x3 : (x - 16.0 / 116.0) / 7.787;
    y = (lab.x > 0.008856 * 903.3) ? pow((lab.x + 16.0) / 116.0, 3.0) : lab.x / 903.3;
    z = (z3 > 0.008856) ? z3 : (z - 16.0 / 116.0) / 7.787;
    
    return vec3(x, y, z);
}

// Function to convert XYZ to RGB
vec3 xyz2rgb(vec3 xyz) {
    vec3 rgb = vec3(
        xyz.x *  3.2406 + xyz.y * -1.5372 + xyz.z * -0.4986,
        xyz.x * -0.9689 + xyz.y *  1.8758 + xyz.z *  0.0415,
        xyz.x *  0.0557 + xyz.y * -0.2040 + xyz.z *  1.0570
    );
    return clamp(rgb, 0.0, 1.0);
}

// Function to convert LCH to RGB
vec3 lch2rgb(vec3 lch) {
    vec3 lab = lch2lab(lch);
    vec3 xyz = lab2xyz(lab);
    return xyz2rgb(xyz);
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
    if (newGridIndex != oldGridIndex) {
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

    float depth = newPosition.z / u_canvasSize.z + 0.5;
    
    // lch(91.76% 55.22 165.82)
    vec3 lch1 = vec3(91.76, 55.22, 165.82); 
    // lch(18.66% 78.89 308.64)
    vec3 lch2 = vec3(18.66, 78.89, 308.64);

    float k = 10.0;
    float activation = 1.0 / (1.0 + exp((0.5 - depth) * k));

    // Interpolate between the two LCH colors based on depth
    vec3 lch = mix(lch1, lch2, activation);

    // Convert interpolated LCH to RGB
    rgb = lch2rgb(lch);
    
    gl_Position = clipSpace;
    gl_PointSize = u_pointSize / clipSpace.w * 1000.0; 
}