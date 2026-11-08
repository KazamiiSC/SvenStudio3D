/** Compiled GoldSrc BSP30 lighting material shader.
 * In Three r175, the built-in uv1 GLSL declaration is only enabled for
 * requested built-in texture channels. A custom ShaderMaterial with texture
 * uniforms does not request the channel. Instead declare a named attribute
 * and bind it explicitly (same BufferAttribute as the built-in uv1 data).
 */
export const BSP_BAKED_LIGHT_UV_ATTRIBUTE='bspLightUv';
export const BSP_BAKED_VERTEX_SHADER=`
attribute vec2 bspLightUv;
varying vec2 vUvBase;
varying vec2 vUvLight;
varying float vViewDepth;
void main() {
  vUvBase=uv;
  vUvLight=bspLightUv;
  vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
  vViewDepth=-viewPosition.z;
  gl_Position=projectionMatrix*viewPosition;
}`;
export const BSP_BAKED_FRAGMENT_SHADER=`
uniform sampler2D uDiffuse;
uniform sampler2D uLighting;
uniform float uGain;
uniform float uOpacity;
uniform float uAlphaCutoff;
// Display calibration is OFF at 1.0. It never rewrites the baked RGB texture.
uniform float uDisplayGamma;
// Runtime env_fog (not part of the static SC-RAD light samples).
uniform bool uFogEnabled;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
varying float vViewDepth;
varying vec2 vUvBase;
varying vec2 vUvLight;
void main() {
  vec4 albedo=texture2D(uDiffuse,vUvBase);
  if(albedo.a<uAlphaCutoff)discard;
  vec3 irradiance=texture2D(uLighting,vUvLight).rgb;
  vec3 litColor=albedo.rgb*irradiance*uGain;
  litColor=pow(max(litColor,vec3(0.0)),vec3(1.0/max(uDisplayGamma,0.1)));
  if(uFogEnabled){
    float fogFactor=clamp((vViewDepth-uFogStart)/max(uFogEnd-uFogStart,0.001),0.0,1.0);
    litColor=mix(litColor,uFogColor,fogFactor);
  }
  gl_FragColor=vec4(litColor,albedo.a*uOpacity);
  #include <colorspace_fragment>
}`;
