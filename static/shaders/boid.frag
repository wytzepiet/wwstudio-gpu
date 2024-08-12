#version 300 es
precision mediump float;

in float v_depth; // Receive the depth value from vertex shader
out vec4 fragColor;

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
    
    // lch(91.76% 55.22 165.82)
    vec3 lch1 = vec3(91.76, 55.22, 165.82);
    // lch(45.68% 106.83 321.99)
    vec3 lch2 = vec3(45.68, 106.83, 321.99);

    float t = clamp(v_depth * 2.0 - 0.5, 0.0, 1.0);

    // Interpolate between the two LCH colors based on depth
    vec3 lch = mix(lch1, lch2, t);

    // Convert interpolated LCH to RGB
    vec3 rgb = lch2rgb(lch);

    // Output the color
    fragColor = vec4(rgb, 1.0);
}
