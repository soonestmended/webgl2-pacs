#version 300 es

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_wl;

in vec4 a_position;
in vec2 a_texcoord;

out vec2 v_texcoord;

void main() {
	gl_Position = a_position;
	v_texcoord = a_texcoord;
}