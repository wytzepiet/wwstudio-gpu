#version 300 es
precision highp float;

in vec3 v_velocity;
out vec4 fragColor;

void main() {
    fragColor = vec4(v_velocity, 1.0);
}
