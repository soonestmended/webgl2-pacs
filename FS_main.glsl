#version 300 es
precision highp float;
precision highp int;
precision highp isampler3D;
precision highp sampler3D;

uniform sampler3D u_tex;

uniform isampler3D u_maskTex;
uniform float u_maskAlpha;

uniform vec4 u_viewportInfo;
uniform vec3 u_voxelDim;
uniform vec2 u_screenDim;

uniform vec2 u_wl;

uniform mat4 u_world2voxel;

in vec3 v_texcoord;
out vec4 color;

vec4 clampToBorder(vec4 c, vec3 uvw) {
	return (uvw.x < 0.0 || uvw.x > 1.0 || uvw.y < 0.0 || uvw.y > 1.0 || uvw.z < 0.0 || uvw.z > 1.0) ? vec4(0.0, 0.0, 0.0, 1.0) : c;
}

void main() {
	// Also need to transform gl_FragCoord.xy so that it ranges from [0 - 1] x [0 - 1] over the viewport as opposed to the screen.
	// to start with, FragCoord goes from [0, 1] x [0, 1] over screen space.
	// start with canonical plane

	//vec2 uvViewport = (gl_FragCoord.xy - u_viewportInfo.xy) / u_viewportInfo.zw; // uvViewport now [0, 1] x [0, 1] over viewport
	//uvViewport = (uvViewport - vec2(0.5)) * u_viewportInfo.zw;
	// now uvViewport is [-viewport/2, -viewport/2] x [viewport/2, viewport/2]

	// Take center of slice plane as (0, 0, 0). u_world2voxel represents the transformation matrix to move the worldspace center to the desired position in voxel space.
	
	//vec4 uvw = vec4(uvViewport, 0.0, 1.0);
	//uvw = u_world2voxel * uvw;

	//uvw.xy = (gl_FragCoord.xy - u_viewportInfo.xy) / u_viewportInfo.zw;

	vec4 rawData = texture(u_tex, v_texcoord);
    ivec4 maskData = texture(u_maskTex, v_texcoord);
    float scale = 1.0 / u_wl.x;
    float offset = u_wl.y - (u_wl.x / 2.0);
	float data = (float(rawData.x) - offset) * scale;
    float mask = float(maskData.x) * .5;

	vec3 dataColor = clamp(vec3(data), 0.0, 1.0);
	color = vec4(mix(dataColor, vec3(.2, .2, .9), mask), 1.0);
	color = clampToBorder(color, v_texcoord);
	//color = vec4(vec3(data), 1.0);
	//gl_FragColor = vec4(mask_data.xyz, 1.0);
}
