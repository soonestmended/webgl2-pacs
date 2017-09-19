#version 300 es

precision highp float;

uniform vec2 u_resolution;
uniform vec3 u_voxelDim;
uniform vec2 u_dxdy;
uniform vec4 u_viewportInfo;
uniform mat4 u_world2voxel;
uniform mat4 u_voxel2world;

in vec4 a_position;

void main() {
	vec2 p = a_position.xy * u_viewportInfo.zw * vec2(0.5);
	p += u_dxdy;
	gl_Position = vec4(p / u_viewportInfo.zw, 0.0, 1.0);
	gl_Position = a_position - vec4(vec2(2.0)*u_dxdy / u_viewportInfo.zw, 0.0, 0.0);
}