#version 300 es

precision highp float;

uniform vec2 u_resolution;
uniform vec3 u_voxelDim;
uniform vec2 u_dxdy;
uniform vec4 u_lineColor;
uniform vec2 u_cs;
uniform vec4 u_viewportInfo;
uniform mat4 u_world2voxel;
uniform mat4 u_voxel2world;

in vec4 a_position;

void main() {
//	vec4 p = vec4(a_position.xy * u_viewportInfo.zw * vec2(0.5), 0.0, 1.0);
	vec4 p = vec4(a_position.x * u_cs.x - a_position.y * u_cs.y, a_position.x * u_cs.y + a_position.y * u_cs.x, 0.0, 1.0);
	
	p -= vec4(vec2(2.0)*u_dxdy/u_viewportInfo.z, 0.0, 0.0);
	gl_Position = vec4(p.xyz, 1.0);// / vec4(u_viewportInfo.zw, 1.0, 1.0);
//	gl_Position = a_position - vec4(vec2(2.0)*u_dxdy / u_viewportInfo.zw, 0.0, 0.0);
}