#version 300 es
precision highp float;

in vec3 v_position;
in vec3 v_velocity;

layout(location = 0) out vec4 position;
layout(location = 1) out vec4 velocity;

void main() {
    position = vec4(1.0);
    velocity = vec4(1.0); 
}