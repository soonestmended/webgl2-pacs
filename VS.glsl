#version 300 es

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_wl;

uniform vec4 u_viewportInfo;
uniform vec3 u_voxelDim;
uniform vec2 u_screenDim;

uniform mat4 u_world2voxel;

in vec4 a_position;
in vec2 a_texcoord;

out vec3 v_texcoord;

void main() {
	gl_Position = a_position;
	// a_position varies from -1 to +1
	// how do we calculate the tex coords we want right here in the vertex shader?
	// first get from [-1, 1] x [-1, 1] to the canonical plane
	// we know the viewport width and height.
	vec4 texCoord = vec4(a_position.xy * u_viewportInfo.zw / vec2(2.0), 0.0, 1.0);

	// v_texcoord is now [-viewportWidth/2, -viewportHeight/2] x [viewportWidth/2, viewportHeight/2]
	// next transform it by world2voxel

	texCoord = u_world2voxel * texCoord;

	// now texCoord is in voxel coordinates

	v_texcoord = texCoord.xyz / u_voxelDim;
}