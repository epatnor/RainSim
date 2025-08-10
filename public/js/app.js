// public/js/app.js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/examples/jsm/postprocessing/ShaderPass.js';

// ---------- UI refs ----------
const $ = (id)=>document.getElementById(id);
const dot=$("dot"), stat=$("stat"), pullBtn=$("pullBtn"), pushBtn=$("pushBtn"), autoBtn=$("autoBtn");

// ---------- State ----------
const state = { timeOfDay:16, rain:0.4, wetness:0.5, fog:0.35, cloudiness:0.4, wind:0.3, exposure:1.0 };
const keys = Object.keys(state);

// sliders
for (const k of keys){
  const input = $(k), val = $(`v_${k}`);
  input.addEventListener("input", e=>{
    state[k] = Number(e.target.value);
    val.textContent = e.target.value;
    schedulePush();
  });
}
function syncUI(){ for (const k of keys){ $(k).value=state[k]; $(`v_${k}`).textContent=state[k]; } }

// ---------- API ----------
const BASE = "";
function setStatus(ok){ dot.classList.toggle("ok", !!ok); stat.textContent = ok ? "Connected" : "Disconnected"; }
async function apiGet(){ try{ const r=await fetch(`${BASE}/api/scene`); if(!r.ok) throw 0; Object.assign(state, await r.json()); setStatus(true); syncUI(); } catch{ setStatus(false); } }
async function apiPostAll(){ try{ const r=await fetch(`${BASE}/api/scene`,{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify(state)}); if(!r.ok) throw 0; Object.assign(state, await r.json()); setStatus(true); syncUI(); } catch{ setStatus(false); } }
async function apiPatch(delta){ try{ const r=await fetch(`${BASE}/api/scene`,{method:"PATCH",headers:{'Content-Type':'application/json'},body:JSON.stringify(delta)}); if(!r.ok) throw 0; Object.assign(state, await r.json()); setStatus(true); syncUI(); } catch{ setStatus(false); } }
pullBtn.onclick = ()=> apiGet();
pushBtn.onclick = ()=> apiPostAll();
let auto=false, timer=null, pushDebounce=null, lastSent={...state};
autoBtn.onclick = ()=>{
  auto=!auto; autoBtn.dataset.on=auto?'1':'0'; autoBtn.textContent=`Auto: ${auto?'On':'Off'}`;
  if(auto) timer=setInterval(apiGet, 1000); else { clearInterval(timer); timer=null; }
};
function schedulePush(){
  if(!auto) return;
  clearTimeout(pushDebounce);
  pushDebounce = setTimeout(()=>{
    const delta={}; for(const k of keys){ if(state[k]!==lastSent[k]) delta[k]=state[k]; }
    if(Object.keys(delta).length){ lastSent={...state}; apiPatch(delta); }
  }, 140);
}

// ---------- THREE ----------
const host = $("viewport");
const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a2330, 0.008);

const camera = new THREE.PerspectiveCamera(60, host.clientWidth/host.clientHeight, 0.1, 1000);
camera.position.set(10, 7, 12);
camera.lookAt(0, 1.0, 0);

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 20, 10); scene.add(sun);
const amb = new THREE.AmbientLight(0xffffff, 0.25); scene.add(amb);

function skyColorAt(t, cloud){
  const day = Math.cos((t-12)*Math.PI/12)*0.5+0.5;
  const dusk = Math.exp(-((t-18)**2)/4.84)+Math.exp(-((t-6)**2)/4.84);
  const noon = new THREE.Color(0x7fb6ff), night= new THREE.Color(0x0b1020), duskC= new THREE.Color(0xffb36b);
  return new THREE.Color().copy(night).lerp(noon, day).lerp(duskC, Math.min(1,dusk)).lerp(new THREE.Color(0x3a4555), cloud*0.5);
}

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

// ground
{ const g = new THREE.Mesh(
    new THREE.PlaneGeometry(60,40),
    makeWettable(new THREE.MeshStandardMaterial({ color:0x7f8992, roughness:0.88, metalness:0.02 }))
  ); g.rotation.x=-Math.PI/2; scene.add(g); }

// house
{ const body=new THREE.Mesh(new THREE.BoxGeometry(4,3,3), makeWettable(new THREE.MeshStandardMaterial({ color:0xbfb8a6, roughness:0.85 }))); body.position.set(0,1.5,0); scene.add(body);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(3.2,1.6,4), makeWettable(new THREE.MeshStandardMaterial({ color:0x70413c, roughness:0.7 }))); roof.rotation.y=Math.PI/4; roof.position.set(0,3.6,0); scene.add(roof);
  const door=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.6), makeWettable(new THREE.MeshStandardMaterial({ color:0x4e575f, roughness:0.6 }))); door.position.set(1.1,0.8,1.51); scene.add(door);
  const win=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9), makeWettable(new THREE.MeshStandardMaterial({ color:0x6bb6ff, roughness:0.2 }))); win.position.set(-0.9,1.4,1.51); scene.add(win); }

// wall + towers
{ const wall=new THREE.Mesh(new THREE.BoxGeometry(60,6,1.2), makeWettable(new THREE.MeshStandardMaterial({ color:0x5b6672, roughness:0.9 }))); wall.position.set(0,3,-12); scene.add(wall);
  for(let i=-2;i<=2;i++){ const t=new THREE.Mesh(new
