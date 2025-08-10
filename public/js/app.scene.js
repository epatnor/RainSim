// public/js/app.scene.js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/examples/jsm/postprocessing/ShaderPass.js';

const $ = (id)=>document.getElementById(id);
const host = $("viewport");

// ------- STATE -------
const state = {
  timeOfDay: 16, rain: 0.4, wetness: 0.5, fog: 0.35, cloudiness: 0.4, wind: 0.3, exposure: 1.0,
  weatherDensity: 2 // 0..3 (WoW-lik diskret densitet)
};

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
  ground.rotation.x = -Math.PI/2; scene.add(ground);

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

// ------- POST: WoW-lik regn-overlay -------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const rainPass = new ShaderPass({
  uniforms:{
    tDiffuse:{ value:null },
    uTime:{ value:0 },
    uRain:{ value:state.rain },
    uWind:{ value:state.wind },
    uExposure:{ value:state.exposure },
    uRes:{ value:new THREE.Vector2(host.clientWidth, host.clientHeight) },
    uDensity:{ value: state.weatherDensity } // 0..3
  },
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uRain, uWind, uExposure, uDensity;
    uniform vec2  uRes;
    varying vec2 vUv;

    float hash(float n){ return fract(sin(n)*43758.5453); }

    vec2 rotate(vec2 p, float a){
      float s=sin(a), c=cos(a);
      return vec2(c*p.x - s*p.y, s*p.x + c*p.y);
    }

    // Ett "WoW-lager": kolumnstreck med discrete dash
    float rainLayer(vec2 uv, float t, float columns, float speed, float width, float slant){
      float aspect = uRes.x / max(1.0, uRes.y);
      uv.x *= aspect;

      float ang = radians(-18.0) * clamp(slant, 0.0, 1.0);
      uv = rotate(uv - 0.5, ang) + 0.5;
      uv.x += slant * (uv.y * 0.22);

      vec2 g = uv * vec2(columns, 1.0);
      float colId = floor(g.x);
      float rnd   = hash(colId*57.0 + floor(t)*13.0);

      float col = abs(fract(g.x) - 0.5);
      float line = smoothstep(width, 0.0, col);

      float y = g.y + t*speed + rnd;
      float seg = fract(y);
      float dash = step(0.05, seg) * step(seg, 0.35);

      float amp = mix(0.55, 1.0, hash(colId*91.0));
      return line * dash * amp;
    }

    vec3 tone(vec3 c, float e){ c*=e; return c/(c+vec3(1.0)); }

    void main(){
      vec3 sceneCol = texture2D(tDiffuse, vUv).rgb;
      int d = int(clamp(uDensity, 0.0, 3.0));
      float slant = clamp(uWind, 0.0, 1.0);
      float t = uTime;

      float acc = 0.0;
      if (d >= 1){ acc += rainLayer(vUv, t*1.00, 28.0, 1.0, 0.020, slant); }
      if (d >= 2){ acc += rainLayer(vUv, t*1.25, 40.0, 1.3, 0.016, slant); }
      if (d >= 3){ acc += rainLayer(vUv, t*1.55, 58.0, 1.6, 0.012, slant); }

      acc *= clamp(uRain * (0.7 + float(d)*0.3), 0.0, 1.6);

      vec3 rainTint = vec3(0.12, 0.16, 0.20) * min(1.0, uRain*0.9 + float(d)*0.2);
      vec3 col = sceneCol * (1.0 - 0.06*uRain - 0.04*float(d)) + rainTint;

      // enkel additive highlight
      col += vec3(0.55) * acc * 0.18;

      gl_FragColor = vec4(tone(col, uExposure), 1.0);
    }
  `
});
composer.addPass(rainPass);

// ------- RESIZE -------
addEventListener('resize', ()=>{
  const w=host.clientWidth, h=host.clientHeight;
  renderer.setSize(w,h);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  rainPass.uniforms.uRes.value.set(w,h);
});

// ------- FRAME UPDATE -------
const tmpCol = new THREE.Color();
function updateVisuals(){
  // diskret WoW-känsla: mappa slider till 0..3
  state.weatherDensity = Math.min(3, Math.floor(state.rain * 4.0 + 0.001));

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

  rainPass.uniforms.uRain.value     = state.rain;
  rainPass.uniforms.uWind.value     = state.wind;
  rainPass.uniforms.uExposure.value = state.exposure;
  rainPass.uniforms.uTime.value     = performance.now()*0.001;
  rainPass.uniforms.uDensity.value  = state.weatherDensity;
}

function tick(){ updateVisuals(); composer.render(); requestAnimationFrame(tick); }
tick();

window.__RainSimState = state;
console.log('RainSim 3D scene booted (WoW rain)');
