#version 300 es

precision highp float;

uniform vec2 u_wl;

uniform vec4 u_viewportInfo;
uniform vec3 u_voxelDim;
uniform vec2 u_screenDim;
uniform mat4 u_xfti;
uniform mat4 u_world2voxel;
uniform vec3 u_normal;
uniform vec3 u_center;
uniform float u_scale;
uniform vec3 u_U;
uniform vec3 u_V;
uniform float d;

in vec4 a_position;
in vec2 a_texcoord;

out vec3 v_texcoord;

void main() {
	gl_Position = a_position;

	vec4 texCoord = vec4(a_position.xy * u_viewportInfo.zw/2.0, 0.0, 1.0);
	
	vec4 U = u_scale * vec4(u_U, 0);
	vec4 V = u_scale * vec4(u_V, 0);
	float dist = dot(u_center, u_normal);
	vec4 C = vec4(vec3(dist) * u_normal, 1.0);
	texCoord = u_world2voxel * (C + vec4(texCoord.x) * U + vec4(texCoord.y) * V);

	// now texCoord is in voxel coordinates -- scale to [0, 1]^3

	v_texcoord = texCoord.xyz / u_voxelDim;
}