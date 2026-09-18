shader_type spatial;
render_mode cull_back;
uniform sampler2D grass : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D forest : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D sand : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dirt : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rock : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D snow : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 world_pos;
varying vec3 world_normal;
void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = (MODEL_NORMAL_MATRIX * NORMAL);
}
float noise2(vec2 p) {
	return sin(p.x * .037 + sin(p.y * .029)) * sin(p.y * .041 + sin(p.x * .025));
}
float town_roads(vec2 p, vec2 center) {
	vec2 d = p - center;
	float a = .0872665;
	d = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * d;
	float lanes = min(abs(d.x), abs(d.y));
	float ring = abs(length(d) - 52.0);
	return (1.0 - smoothstep(2.8, 5.0, min(lanes, ring))) * (1.0 - smoothstep(112.0, 130.0, length(d)));
}
void fragment() {
	vec2 p = world_pos.xz;
	vec2 uv = p / 4.0;
	float meadow_d = distance(p, vec2(-300.0, 250.0)) / 320.0;
	float forest_d = distance(p, vec2(20.0, 10.0)) / 300.0;
	float sand_d = distance(p, vec2(360.0, -120.0)) / 330.0;
	vec3 weights = exp(-12.0 * vec3(meadow_d, forest_d, sand_d));
	weights /= max(dot(weights, vec3(1.0)), 0.00001);
	vec3 col = texture(grass, uv).rgb * weights.x + texture(forest, uv).rgb * weights.y + texture(sand, uv).rgb * weights.z;
	float town = 1.0 - smoothstep(95.0, 118.0, min(distance(p, vec2(-430.0, 400.0)), distance(p, vec2(430.0, -400.0))));
	col *= 0.96 + 0.08 * noise2(p);
	// Gardens and paths replace the previous unbroken disc of bare dirt.
	col = mix(col, texture(grass, uv).rgb, town * 0.9);
	float roads = max(town_roads(p, vec2(-430.0,400.0)), town_roads(p, vec2(430.0,-400.0)));
	col = mix(col, texture(dirt, uv).rgb, roads);
	float rocky = max(smoothstep(0.35, 0.6, 1.0 - world_normal.y), smoothstep(38.0, 55.0, world_pos.y));
	col = mix(col, texture(rock, uv).rgb, rocky);
	col = mix(col, texture(snow, uv).rgb, smoothstep(72.0, 86.0, world_pos.y));
	ALBEDO = col;
	ROUGHNESS = 0.95;
}
