#version 300 es
precision highp float;
precision highp int;
precision highp isampler3D;

uniform isampler3D u_tex;
uniform isampler3D u_maskTex;
uniform float u_maskAlpha;
uniform vec2 u_resolution;
uniform vec2 u_wl;
uniform float u_slice;

in vec2 v_texcoord;
out vec4 color;

void main() {
	vec3 uvw =  vec3(gl_FragCoord.xy/u_resolution, u_slice);
    ivec4 rawData = texture(u_tex, uvw);
    ivec4 maskData = texture(u_maskTex, uvw);
    float scale = 1.0 / u_wl.x;
    float offset = u_wl.y - (u_wl.x / 2.0);
	float data = (float(rawData.x) - offset) * scale;
    float mask = float(maskData.x) * .5;

	vec3 dataColor = clamp(vec3(data), 0.0, 1.0);
	color = vec4(mix(dataColor, vec3(.2, .2, .9), mask), 1.0);
	//color = vec4(vec3(data), 1.0);
	//gl_FragColor = vec4(mask_data.xyz, 1.0);
}
