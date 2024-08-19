#version 300 es
precision mediump float;
precision mediump sampler3D;

in vec3 a_position;
in vec3 a_velocity;

uniform mat4 u_projectionMatrix;
uniform mat4 u_viewMatrix;
uniform vec3 u_canvasSize;
uniform vec3 u_mouse;
uniform float u_maxSpeed;
uniform float u_maxForce;
uniform float u_pointSize;
uniform sampler3D u_grid;
uniform vec3 u_gridSize;
uniform float u_cellSize;

out vec3 v_position;
out vec3 v_velocity;
out vec3 rgb;


vec3 rgbToHsl(vec3 color) {
    float r = color.r;
    float g = color.g;
    float b = color.b;

    float max = max(max(r, g), b);
    float min = min(min(r, g), b);
    float delta = max - min;

    float h = 0.0;
    float s = 0.0;
    float l = (max + min) / 2.0;

    if (delta > 0.0) {
        s = l < 0.5 ? delta / (max + min) : delta / (2.0 - max - min);
        if (max == r) {
            h = (g - b) / delta + (g < b ? 6.0 : 0.0);
        } else if (max == g) {
            h = (b - r) / delta + 2.0;
        } else {
            h = (r - g) / delta + 4.0;
        }
        h /= 6.0;
    }
    return vec3(h, s, l);
}
 float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0 / 2.0) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}
        
vec3 hslToRgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;

    float r, g, b;

    if (s == 0.0) {
        r = g = b = l; // Achromatic (gray)
    } else {
        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
       
        r = hue2rgb(p, q, h + 1.0 / 3.0);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1.0 / 3.0);
    }

    return vec3(r, g, b);
}



void main() {
    // Move toward mouse
    vec3 force = u_mouse - a_position;
    if(length(force) > u_maxForce) {
        force = normalize(force) * u_maxForce;
    }
    vec3 newVelocity = a_velocity + force;
    newVelocity = normalize(newVelocity) * u_maxSpeed;

    // Update logic: move position by velocity
    vec3 newPosition = a_position + newVelocity;

    // Pass updated positions and velocities to the transform feedback
    v_position = newPosition;
    v_velocity = newVelocity;

    // Convert position to clip space using projection and view matrices
    vec4 clipSpace = u_projectionMatrix * u_viewMatrix * vec4(newPosition, 1.0);
    
    float depth = newPosition.z / u_canvasSize.z + 0.5;
    
    float k = 20.0;
    float activation = 1.0 / (1.0 + exp((0.5 - depth) * k));

    // #54da7f
    vec3 col1  = vec3(0.32941176470588235, 0.8549019607843137, 0.4980392156862745);
    // #1d1594
    vec3 col2  = vec3(0.403921568627451, 0.0, 0.8509803921568627);
    
    // Convert interpolated LCH to RGB
    // rgb = mix(col1, col2, activation);

    vec3 hsl = mix(rgbToHsl(col1), rgbToHsl(col2), activation);
    rgb = hslToRgb(hsl);

    
    gl_Position = clipSpace;
    gl_PointSize = u_pointSize / clipSpace.w * 1000.0; 
}