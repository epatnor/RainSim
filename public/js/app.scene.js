// public/js/app.scene.js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/examples/jsm/postprocessing/ShaderPass.js';

const $ = (id)=>document.getElementById(id);
const host = $("viewport");

// ------- STATE (läst/skrivs av GUI via API när du vill) -------
const state = { timeOfDay:16, rain:0.4, wetness:0.5, fog:0.35, cloudiness:0.4, wind:0.3, exposure:1.0 };

// ------- RENDERER -------
const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio||1, 1.5));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

// ------- SCENE/CAMERA -------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2330, 0.008);

const camera = new THREE.PerspectiveCamera(60, host.clientWidth/host.clientHeight, 0.1, 1000);
camera.position.set(10, 7, 12);
camera.lookAt(0, 1.0, 0);

// ------- LIGHTS -------
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 20, 10); scene.add(sun);
const amb = new THREE.AmbientLight(0xffffff, 0.25); scene.add(amb);

// ------- UTILS -------
function skyColorAt(t, cloud){
  const day  = Math.cos((t-12)*Math.PI/12)*0.5+0.5;
  const dusk = Math.exp(-((t-18)**2)/4.84)+Math.exp(-((t-6)**2)/4.84);
  const noon = new THREE.Color(0x7fb6ff), night=new THREE.Color(0x0b1020), duskC=new THREE.Color(0xffb36b);
  return new THREE.Color().copy(night).lerp(noon, day).lerp(duskC, Math.min(1, dusk)).lerp(new THREE.Color(0x3a4555), cloud*0.5);
}

// “wet” hook för MeshStandardMaterial
function makeWettable(mat){
  mat.onBeforeCompile = (shader)=>{
    shader.uniforms.uWetness = { value: state.wetness };
    shader.uniforms.uRain    = { value: state.rain };
    shader.uniforms.uTime    = { value: 0.0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPosW;`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nvPosW=(modelMatrix*vec4(position,1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPosW;\nuniform float uWetness,uRain,uTime;`)
      .replace('#include <output_fragment>', `
        vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
        float topness = saturate(dot(worldNormal, vec3(0.0, 1.0, 0.0)));
        float wet = uWetness * (0.35 + 0.65 * topness);
        float n = fract(sin(dot(vPosW.xz + uTime*0.1, vec2(12.9898,78.233))) * 43758.5453);
        wet *= mix(0.85, 1.1, n);
        vec3 wetColor = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6, wet);
        float wetRough = clamp(roughnessFactor, 0.04, 1.0);
        wetRough = mix(wetRough, 0.06, wet);
        diffuseColor.rgb = wetColor;
        roughnessFactor = wetRough;
        #include <output_fragment>
      `);
    mat.userData.shader = shader;
  };
  return mat;
}

// ------- GEO: mark, hus, mur -------
{
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    makeWettable(new THREE.MeshStandardMaterial({ color:0x7f8992, roughness:0.88, metalness:0.02 }))
  );
  ground.rotation.x = -Math.PI/2;
  scene.add(ground);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4,3,3),
    makeWettable(new THREE.MeshStandardMaterial({ color:0xbfb8a6, roughness:0.85 }))
  );
  body.position.set(0,1.5,0); scene.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.2,1.6,4),
    makeWettable(new THREE.MeshStandardMaterial({ color:0x70413c, roughness:0.7 }))
  );
  roof.rotation.y=Math.PI/4; roof.position.set(0,3.6,0); scene.add(roof);

  const door=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.6), makeWettable(new THREE.MeshStandardMaterial({ color:0x4e575f, roughness:0.6 })));
  door.position.set(1.1,0.8,1.51); scene.add(door);

  const win=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9), makeWettable(new THREE.MeshStandardMaterial({ color:0x6bb6ff, roughness:0.2 })));
  win.position.set(-0.9,1.4,1.51); scene.add(win);

  const wall=new THREE.Mesh(new THREE.BoxGeometry(60,6,1.2), makeWettable(new THREE.MeshStandardMaterial({ color:0x5b6672, roughness:0.9 })));
  wall.position.set(0,3,-12); scene.add(wall);

  for(let i=-2;i<=2;i++){
    const t=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.2,8,12), makeWettable(new THREE.MeshStandardMaterial({ color:0x56606b, roughness:0.85 })));
    t.position.set(i*12,4,-12); scene.add(t);
  }
}

// ------- POST: regn-overlay -------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const rainPass = new ShaderPass({
  uniforms:{ tDiffuse:{value:null}, uTime:{value:0}, uRain:{value:state.rain}, uWind:{value:state.wind}, uExposure:{value:state.exposure} },
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`
    precision highp float; uniform sampler2D tDiffuse; uniform float uTime,uRain,uWind,uExposure; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float rainStreaks(vec2 uv,float t,float intensity,float slant){
      uv.x += slant*(uv.y*0.5); float d=0.0;
      for(int i=0;i<3;i++){ float s=float(i+1); vec2 g=uv*vec2(1.0,6.0*s)+vec2(0.0,t*1.2*s);
        float f=fract(g.y+hash(floor(vec2(g.x,g.y)))); float line=smoothstep(0.02,0.0,abs(f-0.5));
        d+=line*(0.25+0.25*s); uv*=1.7; }
      return d*intensity;
    }
    vec3 tone(vec3 c,float e){ c*=e; return c/(c+vec3(1.0)); }
    void main(){
      vec3 base=texture2D(tDiffuse,vUv).rgb;
      float slant=mix(0.0,0.35,uWind);
      float streak=rainStreaks(vUv,uTime*0.7,uRain,slant);
      vec3 rainTint=mix(vec3(0.0),vec3(0.12,0.16,0.20),clamp(uRain*0.9,0.0,1.0));
      vec3 col=base*(1.0-uRain*0.08)+rainTint+vec3(streak)*0.12;
      gl_FragColor=vec4(tone(col,uExposure),1.0);
    }`
});
composer.addPass(rainPass);

// ------- RESIZE -------
addEventListener('resize', ()=>{
  const w=host.clientWidth, h=host.clientHeight;
  renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
});

// ------- FRAME UPDATE -------
const tmpCol = new THREE.Color();
function updateVisuals(){
  const t=state.timeOfDay, elev=Math.cos((t-12)*Math.PI/12), height=Math.max(0.0,elev), azim=(t/24.0)*Math.PI*2.0;
  sun.position.set(Math.sin(azim)*20, 8+height*30, Math.cos(azim)*20);
  sun.intensity=0.2+1.4*height; amb.intensity=0.15+0.35*Math.max(0.0,height);

  const sky=skyColorAt(t,state.cloudiness); renderer.setClearColor(sky,1.0);
  scene.fog.color.copy(sky).lerp(tmpCol.set(0x16202c), state.cloudiness*0.5);
  scene.fog.density=0.004+state.fog*0.01+state.rain*0.004;

  scene.traverse(o=>{
    if(o.isMesh && o.material && o.material.userData.shader){
      const sh=o.material.userData.shader;
      sh.uniforms.uWetness.value=state.wetness;
      sh.uniforms.uRain.value=state.rain;
      sh.uniforms.uTime.value=performance.now()*0.001;
      o.material.metalness=Math.min(0.25, state.wetness*0.15);
    }
  });

  rainPass.uniforms.uRain.value=state.rain;
  rainPass.uniforms.uWind.value=state.wind;
  rainPass.uniforms.uExposure.value=state.exposure;
  rainPass.uniforms.uTime.value=performance.now()*0.001;
}

function tick(){
  updateVisuals();
  composer.render();
  requestAnimationFrame(tick);
}
tick();

// Exponera state till konsolen vid behov (debugga snabbt)
window.__RainSimState = state;
console.log('RainSim 3D scene booted');
