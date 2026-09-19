import { useEffect, useRef, useState } from 'react';
import { draw, effect, frame, init, sampler, surface, target, uniforms } from 'vgpu';
import './AeroShards.css';

/* ─── constants ─────────────────────────────────────────────── */
const PLACEMENTS   = { right: 0, left: 1, center: 2, full: 3 };
const MATERIALS    = { pearl: 0, chrome: 1, satin: 2 };
const INTERACTIONS = { none: 0, repel: 1, attract: 2 };
const EFFECTS      = { none: 0, dither: 1, ascii: 2 };
const FLOWS        = { stream: 0, vortex: 1, ribbon: 2 };
const RIPPLE_SPEED = 4.2;
const RIPPLE_TAIL  = 1.8;

const MATERIAL_PRESETS: Record<string, { roughness: number; brightness: number; glow: number; highlightMix: number }> = {
  pearl:  { roughness: 0.46, brightness: 0.92, glow: 0.54, highlightMix: 0.78 },
  chrome: { roughness: 0.1,  brightness: 1.12, glow: 0.38, highlightMix: 0.9  },
  satin:  { roughness: 0.74, brightness: 0.84, glow: 0.42, highlightMix: 0.66 },
};
const DETAIL_PRESETS: Record<string, { count: number; size: number }> = {
  bold:     { count: 0.58, size: 1.32 },
  balanced: { count: 1,    size: 0.96 },
  fine:     { count: 1.15, size: 0.7  },
};
const QUALITY_PRESETS: Record<string, { count: number; dpr: number; supersamplePixels: number }> = {
  low:    { count: 1900, dpr: 1.5, supersamplePixels: 3_000_000 },
  medium: { count: 3200, dpr: 2,   supersamplePixels: 6_000_000 },
  high:   { count: 4600, dpr: 2,   supersamplePixels: 8_000_000 },
};
const RUNTIME_QUALITY = [{ countScale: 1 }, { countScale: 0.86 }, { countScale: 0.72 }];
const BLOOM_SCALES    = [0.25, 0.22, 0.18];
const FRAME_STATES = {
  interactive: { interval: 1000 / 60, continuous: true  },
  settling:    { interval: 1000 / 60, continuous: true  },
  ambient:     { interval: 1000 / 60, continuous: true  },
  partial:     { interval: 1000 / 12, continuous: false },
};

/* ─── helpers ───────────────────────────────────────────────── */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mixColor = (a: number[], b: number[], t: number) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, 1];
const parseColor = (value: string, fallback: string): number[] => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
         || /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(fallback)!;
  return [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255, 1];
};

const resolveFrameInterval  = (fs: typeof FRAME_STATES.ambient, ri: number) => fs.continuous ? Math.max(fs.interval, ri) : fs.interval;
const advanceFrameDeadline  = (ts: number, dl: number, interval: number, reset: boolean) => { const n = dl+interval; return reset||n<=ts-0.5 ? ts+interval : n; };
const layoutVector          = (p: number) => [0,1,2,3].map(i => i===p ? 1 : 0);
const resolveQuality = (canvas: HTMLCanvasElement) => { const m=(navigator as any).deviceMemory||6, c=navigator.hardwareConcurrency||6, px=Math.max(1,canvas.clientWidth*canvas.clientHeight); if(canvas.clientWidth<640||m<=4||c<=4) return 'low'; if(px<=360000&&m>=8&&c>=12) return 'high'; return 'medium'; };
const resolveDpr            = (preset: typeof QUALITY_PRESETS.medium, canvas: HTMLCanvasElement) => { const px=Math.max(1,canvas.clientWidth*canvas.clientHeight); return Math.max(1,Math.min(window.devicePixelRatio||1, preset.dpr, Math.sqrt(preset.supersamplePixels/px))); };
const resolveBloomSize = (size: number[], q=0): [number,number] => [Math.max(1,Math.round(size[0]*(BLOOM_SCALES[q]??BLOOM_SCALES[0]))), Math.max(1,Math.round(size[1]*(BLOOM_SCALES[q]??BLOOM_SCALES[0])))];

const createFormation = (flow: number) => ({ weights: layoutVector(flow), velocity: [0,0,0,0] });
const advanceFormation = (state: { weights: number[]; velocity: number[] }, flow: number, elapsed: number, duration: number, frozen: boolean) => {
  const goal = layoutVector(flow);
  if (frozen) { state.weights = goal; state.velocity.fill(0); return; }
  const response = 6/duration, decay = Math.exp(-response*elapsed);
  for (let i=0;i<4;i++) { const off=state.weights[i]-goal[i], mom=state.velocity[i]+response*off; state.weights[i]=goal[i]+(off+mom*elapsed)*decay; state.velocity[i]=(state.velocity[i]-response*mom*elapsed)*decay; }
  if (state.weights.every((v,i)=>Math.abs(v-goal[i])<0.0001&&Math.abs(state.velocity[i])<0.001)) { state.weights=goal; state.velocity.fill(0); }
};
const resolvePathLength = (aspect: number, weights: number[]) => { const side=2.65+0.61*aspect+0.09*aspect*aspect, center=2.3+2*aspect+0.35*aspect*aspect, full=Math.hypot(2.44*aspect,Math.sqrt(5)), mobile=Math.hypot(2.56*aspect,1); return aspect<0.82 ? mobile*(weights[0]+weights[1]+weights[2])+full*weights[3] : side*(weights[0]+weights[1])+center*weights[2]+full*weights[3]; };

const createHold = () => ({ pointerId: null as number|null, elapsed: 0, amount: 0, velocity: 0, phase: 0 });
const advanceHold = (hold: ReturnType<typeof createHold>, elapsed: number, disabled: boolean) => {
  if (disabled) { hold.pointerId=null; hold.elapsed=0; hold.amount=0; hold.velocity=0; return; }
  const prev=hold.elapsed; hold.elapsed=hold.pointerId===null ? 0 : hold.elapsed+elapsed;
  const engaging=hold.pointerId!==null&&hold.elapsed>0.15, step=engaging&&prev<0.15 ? hold.elapsed-0.15 : elapsed;
  const tgt=engaging?1:0, resp=engaging?3.8:3.2, decay=Math.exp(-resp*step), off=hold.amount-tgt, mom=hold.velocity+resp*off;
  hold.amount=tgt+(off+mom*step)*decay; hold.velocity=(hold.velocity-resp*mom*step)*decay;
  if (Math.abs(hold.amount-tgt)<0.0001&&Math.abs(hold.velocity)<0.001) { hold.amount=tgt; hold.velocity=0; }
  if (hold.amount>0) hold.phase+=elapsed*(0.35+hold.amount*0.5);
};

const resetPointerMotion = (p: any) => { p.velocity??=[0,0]; p.velocity[0]=0; p.velocity[1]=0; p.presenceVelocity=0; };
const advancePointer = (p: any, elapsed: number) => {
  if (elapsed<=0) return;
  const resp=26, decay=Math.exp(-resp*elapsed);
  for (let axis=0;axis<2;axis++) { const off=p.position[axis]-p.raw[axis], mom=p.velocity[axis]+resp*off; p.position[axis]=p.raw[axis]+(off+mom*elapsed)*decay; p.velocity[axis]=(p.velocity[axis]-resp*mom*elapsed)*decay; }
  const pTgt=p.active?1:0, pResp=p.active?24:12, pDecay=Math.exp(-pResp*elapsed), pOff=p.presence-pTgt, pMom=p.presenceVelocity+pResp*pOff;
  const next=pTgt+(pOff+pMom*elapsed)*pDecay; p.presence=clamp(next,0,1); p.presenceVelocity=(p.presenceVelocity-pResp*pMom*elapsed)*pDecay;
  if (next!==p.presence) p.presenceVelocity=0;
  if (Math.abs(p.presence-pTgt)<0.001&&Math.abs(p.presenceVelocity)<0.01) { p.presence=pTgt; p.presenceVelocity=0; }
};

const createRipples = () => Array.from({length:4}, ()=>({ origin:[0.5,0.5], age:0, duration:0, strength:0 }));
const startRipple = (ripples: ReturnType<typeof createRipples>, origin: number[], aspect: number, strength=1) => {
  const r=ripples.find(v=>v.strength===0); if (!r) return false;
  r.origin=[...origin]; r.age=0;
  const fx=(1+Math.abs(origin[0]*2-1))*aspect, fy=1+Math.abs(origin[1]*2-1);
  r.duration=Math.hypot(fx,fy)/RIPPLE_SPEED+RIPPLE_TAIL; r.strength=strength; return true;
};
const advanceRipples = (ripples: ReturnType<typeof createRipples>, elapsed: number, disabled: boolean) => { for (const r of ripples) { if (disabled) r.strength=0; if (!r.strength) continue; r.age+=elapsed; if (r.age>=r.duration) r.strength=0; } };

/* ─── shaders (unchanged from original) ─────────────────────── */
const SHARD_SHADER = `
struct ViewParams {
  viewport: vec4f, shape: vec4f, effects: vec4f, composition: vec4f, transport: vec4f,
  formation: vec4f, gather: vec4f, pointer: vec4f, shock: vec4f, shockB: vec4f,
  shockC: vec4f, shockD: vec4f, material: vec4f, light: vec4f, environment: vec4f,
  baseColor: vec4f, highlightColor: vec4f, accentColor: vec4f,
}
struct PathSample { position: vec3f, tangent: vec3f, phase: f32, }
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat, first) baseAlpha: vec4f,
  @location(1) @interpolate(flat, first) creaseColor: vec3f,
  @location(2) localCoord: vec2f,
}
@group(0) @binding(0) var<uniform> view: ViewParams;
fn hashU32(v: u32)->u32{var s=v*747796405u+2891336453u;let w=((s>>((s>>28u)+4u))^s)*277803737u;return(w>>22u)^w;}
fn unitFloat(v: u32)->f32{return f32(hashU32(v))*(1.0/4294967296.0);}
fn safeNormalize(v: vec3f)->vec3f{return v/max(length(v),0.0001);}
fn safeNormalize2(v: vec2f)->vec2f{return v/max(length(v),0.0001);}
fn cubic(p0:f32,p1:f32,p2:f32,p3:f32,t:f32)->f32{let o=1.0-t;return o*o*o*p0+3.0*o*o*t*p1+3.0*o*t*t*p2+t*t*t*p3;}
fn cubicD(p0:f32,p1:f32,p2:f32,p3:f32,t:f32)->f32{let o=1.0-t;return 3.0*o*o*(p1-p0)+6.0*o*t*(p2-p1)+3.0*t*t*(p3-p2);}
fn sideArc(phase:f32)->f32{let lut=array<f32,32>(0.000000,0.052475,0.097829,0.135121,0.166845,0.195164,0.221458,0.246639,0.271368,0.296184,0.321577,0.348019,0.375973,0.405832,0.437746,0.471327,0.505474,0.538781,0.570323,0.599945,0.628000,0.655048,0.681734,0.708795,0.737169,0.768244,0.804295,0.848010,0.894805,0.935083,0.969270,1.000000);let s=clamp(phase,0.0,0.999999)*31.0;let i=min(u32(floor(s)),30u);return mix(lut[i],lut[i+1u],fract(s));}
fn fullArc(phase:f32)->f32{let lut=array<f32,32>(0.000000,0.028092,0.055939,0.083892,0.112291,0.141449,0.171637,0.203033,0.235650,0.269282,0.303537,0.337982,0.372308,0.406392,0.440263,0.474026,0.507794,0.541636,0.575553,0.609470,0.643257,0.676761,0.709855,0.742465,0.774594,0.806319,0.837790,0.869218,0.900862,0.933020,0.965991,1.000000);let s=clamp(phase,0.0,0.999999)*31.0;let i=min(u32(floor(s)),30u);return mix(lut[i],lut[i+1u],fract(s));}
fn centerArc(phase:f32)->f32{let lut=array<f32,32>(0.000000,0.028692,0.059794,0.096620,0.140315,0.179839,0.212476,0.241834,0.270282,0.299332,0.329968,0.362347,0.395341,0.427241,0.457283,0.485900,0.514192,0.543773,0.577230,0.618093,0.661144,0.696770,0.727388,0.756064,0.784657,0.814415,0.845979,0.878880,0.911508,0.942489,0.971712,1.000000);let s=clamp(phase,0.0,0.999999)*31.0;let i=min(u32(floor(s)),30u);return mix(lut[i],lut[i+1u],fract(s));}
fn mobileArc(phase:f32)->f32{let lut=array<f32,32>(0.000000,0.028885,0.057970,0.087431,0.117400,0.147935,0.179017,0.210560,0.242467,0.274689,0.307272,0.340367,0.374193,0.408970,0.444794,0.481483,0.518517,0.555206,0.591030,0.625807,0.659633,0.692728,0.725311,0.757533,0.789440,0.820983,0.852065,0.882600,0.912569,0.942030,0.971115,1.000000);let s=clamp(phase,0.0,0.999999)*31.0;let i=min(u32(floor(s)),30u);return mix(lut[i],lut[i+1u],fract(s));}
fn sidePath(seedPhase:f32,distance:f32,aspect:f32,mirror:f32)->PathSample{let pi=3.14159265359;let pl=2.65+0.61*aspect+0.09*aspect*aspect;let phase=fract(seedPhase+distance/pl);let t=sideArc(phase);let x=cubic(1.24,1.02,-0.28,0.12,t)+sin(t*pi*4.0+0.34)*0.055;let y=cubic(1.38,0.72,-0.56,-1.38,t)+sin(t*pi*2.0-0.6)*0.04;let z=sin(t*pi*3.0)*0.18;let d=vec3f(mirror*aspect*(cubicD(1.24,1.02,-0.28,0.12,t)+cos(t*pi*4.0+0.34)*pi*4.0*0.055),cubicD(1.38,0.72,-0.56,-1.38,t)+cos(t*pi*2.0-0.6)*pi*2.0*0.04,cos(t*pi*3.0)*pi*3.0*0.18);var s:PathSample;s.position=vec3f(mirror*aspect*x,y,z);s.tangent=safeNormalize(d);s.phase=phase;return s;}
fn centerPath(seedPhase:f32,distance:f32,aspect:f32)->PathSample{let pi=3.14159265359;let pl=2.3+2.0*aspect+0.35*aspect*aspect;let phase=fract(seedPhase+distance/pl);let t=centerArc(phase);let angle=mix(-0.25*pi,1.75*pi,t);let aD=2.0*pi;let r=0.72+sin(t*pi*4.0)*0.12;let rD=cos(t*pi*4.0)*pi*4.0*0.12;let d=vec3f(aspect*(-sin(angle)*aD*r+cos(angle)*rD),cos(angle)*aD*r+sin(angle)*rD,cos(t*pi*2.0)*pi*2.0*0.16);var s:PathSample;s.position=vec3f(cos(angle)*r*aspect,sin(angle)*r,sin(t*pi*2.0)*0.16);s.tangent=safeNormalize(d);s.phase=phase;return s;}
fn fullPath(seedPhase:f32,distance:f32,aspect:f32)->PathSample{let pi=3.14159265359;let pw=2.44*aspect;let pl=sqrt(pw*pw+5.0);let phase=fract(seedPhase+distance/pl);let t=fullArc(phase);let d=vec3f(aspect*2.44,cos((t*1.72-0.2)*pi)*1.72*pi*0.54+cos(t*pi*3.0)*pi*3.0*0.12,-sin(t*pi*2.0-0.7)*pi*2.0*0.22);var s:PathSample;s.position=vec3f(mix(-aspect*1.22,aspect*1.22,t),sin((t*1.72-0.2)*pi)*0.54+sin(t*pi*3.0)*0.12,cos(t*pi*2.0-0.7)*0.22);s.tangent=safeNormalize(d);s.phase=phase;return s;}
fn mobilePath(seedPhase:f32,distance:f32,aspect:f32)->PathSample{let pi=3.14159265359;let pw=2.56*aspect;let pl=sqrt(pw*pw+1.0);let phase=fract(seedPhase+distance/pl);let t=mobileArc(phase);let d=vec3f(aspect*2.56,cos(t*pi)*pi*0.28+cos(t*pi*3.0)*pi*3.0*0.06,-sin(t*pi*2.0)*pi*2.0*0.16);var s:PathSample;s.position=vec3f(mix(-aspect*1.28,aspect*1.28,t),-0.86+sin(t*pi)*0.28+sin(t*pi*3.0)*0.06,cos(t*pi*2.0)*0.16);s.tangent=safeNormalize(d);s.phase=phase;return s;}
fn weightedPath(seedPhase:f32,phaseOffset:f32,aspect:f32,weights:vec4f)->PathSample{let phase=fract(seedPhase+phaseOffset);var r:PathSample;r.position=vec3f(0.0);r.tangent=vec3f(0.0);r.phase=phase;if(aspect<0.82){let cw=weights.x+weights.y+weights.z;if(cw>0.0001){let c=mobilePath(phase,0.0,aspect);r.position+=c.position*cw;r.tangent+=c.tangent*cw;}if(weights.w>0.0001){let w=fullPath(phase,0.0,aspect);r.position+=w.position*weights.w;r.tangent+=w.tangent*weights.w;}}else{if(weights.x>0.0001){let rp=sidePath(phase,0.0,aspect,1.0);r.position+=rp.position*weights.x;r.tangent+=rp.tangent*weights.x;}if(weights.y>0.0001){let lp=sidePath(phase,0.0,aspect,-1.0);r.position+=lp.position*weights.y;r.tangent+=lp.tangent*weights.y;}if(weights.z>0.0001){let cp=centerPath(phase,0.0,aspect);r.position+=cp.position*weights.z;r.tangent+=cp.tangent*weights.z;}if(weights.w>0.0001){let wp=fullPath(phase,0.0,aspect);r.position+=wp.position*weights.w;r.tangent+=wp.tangent*weights.w;}}r.tangent=safeNormalize(r.tangent+vec3f(0.0001,0.0,0.0));return r;}
fn pointerField(delta:vec2f,radius:f32,flow:vec2f,depth:f32)->vec2f{let offset=delta/max(radius,0.001);let along=dot(offset,flow);let across=dot(offset,vec2f(-flow.y,flow.x));let aS=along*along;let layer=depth*inverseSqrt(1.0+depth*depth);let bend=(0.22*aS+0.12*layer*along)/(1.0+aS);let cA=(across+bend)/(1.0+layer*0.18);let falloff=exp(-0.28*aS-1.2*cA*cA);return offset*falloff;}
fn rippleWave(age:f32)->f32{if(age<=0.0||age>=${RIPPLE_TAIL}){return 0.0;}let attack=smoothstep(0.0,0.14,age);let release=1.0-smoothstep(1.4,${RIPPLE_TAIL},age);return sin(age*10.0)*exp(-age*3.2)*attack*release;}
fn rippleDisplacement(position:vec3f,pulse:vec4f)->vec4f{if(pulse.w<=0.0001){return vec4f(0.0);}let perspective=1.0/max(0.62,1.0-position.z*0.34);let delta=(position.xy*perspective-pulse.xy)*view.viewport.z;let distance=sqrt(dot(delta,delta)+0.0016)-0.04;let wave=rippleWave(pulse.z-distance/${RIPPLE_SPEED})*pulse.w;let radial=delta/(distance+0.12);return vec4f(radial*wave*0.28,wave*0.12,abs(wave));}
fn shardVertex(index:u32)->vec3f{let fold=0.34;let v=array<vec3f,6>(vec3f(0.0,1.0,fold),vec3f(-0.72,0.0,0.0),vec3f(0.0,-1.0,fold),vec3f(0.0,1.0,fold),vec3f(0.0,-1.0,fold),vec3f(0.72,0.0,0.0));return v[index%6u];}
fn softbox(direction:vec3f,center:vec2f,size:vec2f)->f32{let q=abs((direction.xy-center)/size);let q2=q*q;let q4=q2*q2;return exp(-(q4.x+q4.y));}
fn aces(color:vec3f)->vec3f{let a=2.51;let b=0.03;let c=2.43;let d=0.59;let e=0.14;return clamp((color*(a*color+b))/(color*(c*color+d)+e),vec3f(0.0),vec3f(1.0));}
@vertex fn vs_main(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->VertexOut{
  let seedPhase=unitFloat(ii*1664525u+1013904223u);let seedLane=unitFloat(ii*2246822519u+3266489917u);let seedDepth=unitFloat(ii*668265263u+374761393u);let seedScale=unitFloat(ii*1597334677u+3812015801u);
  let aspect=view.viewport.x;let path=weightedPath(seedPhase,view.transport.x,aspect,view.composition);var direction=path.tangent;var planarNormal=safeNormalize2(vec2f(-direction.y,direction.x));
  let signedLane=seedLane*2.0-1.0;let lane=sign(signedLane)*pow(abs(signedLane),0.72);let widthProfile=0.46+pow(max(sin(path.phase*3.14159265359),0.0),0.72)*0.54;let looseSeed=unitFloat(ii*3266489917u+668265263u);let loose=smoothstep(0.92,1.0,looseSeed);let flowWave=sin(path.phase*37.6991118431+seedDepth*12.0);let laneWidth=(lane*0.56+flowWave*0.055*view.shape.z)*view.shape.x*widthProfile*(1.0+loose*0.72);let depthLane=(seedDepth*2.0-1.0)*view.shape.y+cos(path.phase*31.4159265359+seedLane*8.0)*0.06*view.shape.z;var renderPosition=path.position+vec3f(planarNormal*laneWidth,depthLane);
  if(view.formation.y+view.formation.z>0.00001){let center=vec2f((view.composition.x-view.composition.y)*aspect*0.56,0.0);var fp=renderPosition*view.formation.x;var fd=direction*view.formation.x;if(view.formation.y>0.00001){let radius=0.16+sqrt(seedLane)*0.74*(0.45+view.shape.x*0.55);let angle=seedPhase*6.28318530718+view.viewport.w/radius;let radial=vec2f(cos(angle),sin(angle));let position=vec3f(center+radial*radius,(seedDepth-0.5)*view.shape.y*0.65+radial.y*0.2);fp+=position*view.formation.y;fd+=safeNormalize(vec3f(-radial.y,radial.x,radial.x*0.2))*view.formation.y;}if(view.formation.z>0.00001){let phase2=fract(seedPhase+view.viewport.w/(aspect*3.0+2.0));let angle2=phase2*6.28318530718;let rw=(seedLane-0.5)*0.54*view.shape.x;let pos2=vec3f(mix(-aspect*1.35,aspect*1.35,phase2)+center.x*0.5,sin(angle2)*0.42+cos(angle2*2.0)*rw,(cos(angle2)*0.35+sin(angle2*2.0)*rw+(seedDepth-0.5)*0.12)*view.shape.y);let tan2=safeNormalize(vec3f(aspect*2.7,cos(angle2)*2.638938,-sin(angle2)*2.199115*view.shape.y));fp+=pos2*view.formation.z;fd+=tan2*view.formation.z;}renderPosition=fp;direction=safeNormalize(fd+vec3f(0.0,0.0,0.02*view.formation.x*(1.0-view.formation.x)));planarNormal=safeNormalize2(vec2f(-direction.y,direction.x));}
  if(abs(view.pointer.w)>0.0001){let field=pointerField(view.pointer.xy-renderPosition.xy,view.pointer.z,vec2f(planarNormal.y,-planarNormal.x),renderPosition.z);let lateral=field-direction.xy*dot(field,direction.xy);renderPosition+=vec3f(lateral*view.pointer.w*0.36,0.0);direction=safeNormalize(vec3f(direction.xy+lateral*view.pointer.w*0.65,direction.z));}
  if(view.gather.z>0.00001){let relative=(renderPosition.xy-view.gather.xy)*view.viewport.z;let reach=length(relative);let radius2=sqrt(-2.0*log(max(seedLane,0.0001)));let angle3=seedPhase*6.28318530718+view.gather.w*(0.3+seedDepth*0.18);let orbit=vec2f(cos(angle3),sin(angle3));let layer2=seedDepth*6.28318530718;let drift=vec2f(sin(layer2+view.gather.w*0.22),cos(layer2*1.7-view.gather.w*0.18))*0.055;let cloud=orbit*radius2*vec2f(0.2,0.16)+drift;let cluster=vec3f(view.gather.xy+cloud/view.viewport.z,(seedDepth-0.5)*0.42);let amount=pow(view.gather.z,1.0+seedDepth*0.65+min(reach,4.0)*0.12);let curledDir=safeNormalize(vec3f(-orbit.y,orbit.x,sin(layer2)*0.35));renderPosition=mix(renderPosition,cluster,amount);direction=safeNormalize(mix(direction,curledDir,amount));}
  var rippleLight=0.0;if(view.shock.w+view.shockB.w+view.shockC.w+view.shockD.w>0.0001){let disp=rippleDisplacement(renderPosition,view.shock)+rippleDisplacement(renderPosition,view.shockB)+rippleDisplacement(renderPosition,view.shockC)+rippleDisplacement(renderPosition,view.shockD);rippleLight=min(disp.w,1.5);if(dot(disp.xyz,disp.xyz)>0.0){renderPosition+=disp.xyz;direction=safeNormalize(direction+disp.xyz*0.7);}}
  let shapeLocal=shardVertex(vi);var local=shapeLocal;local.x*=mix(0.72,1.08,seedLane);local.y*=mix(0.82,1.12,seedDepth);local.x+=(seedDepth-0.5)*(1.0-abs(local.y))*0.16;
  var side2=cross(vec3f(0.0,0.0,1.0),direction);let sLS=dot(side2,side2);if(sLS>0.0001){side2*=inverseSqrt(sLS);}else{side2=vec3f(1.0,0.0,0.0);}let facing=cross(direction,side2);let rollDir=mix(-1.5,1.7,seedDepth);let roll=seedLane*6.28318530718+view.viewport.w*rollDir*view.effects.x*2.4;let rS=sin(roll);let rC=cos(roll);let bS=side2*rC+facing*rS;let bF=facing*rC-side2*rS;let depthScale=mix(0.56,1.58,clamp(renderPosition.z*0.62+0.5,0.0,1.0));let scaleShape=0.46+seedScale*0.58+pow(seedScale,12.0)*1.55;let size2=view.viewport.y*scaleShape*depthScale*(1.0-view.gather.z*0.3);let width2=size2*0.72;let lengthScale=size2*1.26*view.effects.z;let world=renderPosition+direction*local.y*lengthScale+bS*local.x*width2+bF*local.z*width2;
  let perspective=1.0/max(0.62,1.0-world.z*0.34);let ndc=world.xy*view.viewport.z/vec2f(aspect,1.0)*perspective;let depth2=clamp(0.56-world.z*0.24,0.03,0.97);let triangle=vi/3u;let corner=vi%3u;var mapped=vec3f(0.0);var mappedCrease=vec3f(0.0);var shardAlpha=0.0;
  if(corner==0u){let facetSide=select(-1.0,1.0,triangle==1u);let localNormal=vec3f(facetSide*0.394903,0.0,0.918723);let normal=bS*localNormal.x+bF*localNormal.z;let viewDir=normalize(vec3f(-renderPosition.xy*0.08,1.0));let pShift=vec2f(view.light.w,view.shape.w);let keyDir=view.light.xyz;let halfDir=normalize(keyDir+viewDir);let roughness=clamp(view.material.x,0.04,0.96);let matKind=view.material.y;let glow2=view.material.w;let refl=reflect(-viewDir,normal);let broad=softbox(refl,vec2f(-0.34,0.28)+pShift*0.36,vec2f(0.52,0.22)+roughness*0.3);let strip=softbox(refl,vec2f(0.48,-0.08)-pShift*0.2,vec2f(0.12,0.72));let diffuse=max(dot(normal,keyDir),0.0);let specPow=mix(92.0,9.0,roughness);let specular=pow(max(dot(normal,halfDir),0.0),specPow);let fresnelBase=1.0-max(dot(normal,viewDir),0.0);let fS=fresnelBase*fresnelBase;let fresnel=fS*fS;let facet=mix(0.76,1.0,smoothstep(-0.08,0.08,normal.x));let depthFog=smoothstep(-0.68,0.58,renderPosition.z);let depthTint=mix(view.accentColor.rgb*0.52,view.baseColor.rgb,depthFog);var color=depthTint*(0.1+diffuse*0.3)*facet;color+=view.highlightColor.rgb*(broad*mix(0.3,0.86,1.0-roughness))*(1.0+glow2*0.14);color+=view.accentColor.rgb*strip*(0.12+fresnel*0.42);color+=view.highlightColor.rgb*specular*mix(0.82,1.0,seedDepth);color+=mix(view.baseColor.rgb,view.accentColor.rgb,seedLane)*fresnel*(0.15+glow2*0.16);color+=view.accentColor.rgb*(broad*0.045+fresnel*0.075)*glow2;var creaseColor=color+view.highlightColor.rgb*(0.08+specular*0.22);if(matKind>0.5&&matKind<1.5){let mL=view.highlightColor.rgb*(broad+specular)*0.32;color=color*1.1+mL;creaseColor=creaseColor*1.1+mL;}else if(matKind>=1.5){let sC=view.baseColor.rgb*(0.46+diffuse*0.46);color=mix(color,sC,0.56);creaseColor=mix(creaseColor,sC,0.56);}let fill=mix(view.accentColor.rgb,view.baseColor.rgb,depthFog)*(0.38+diffuse*0.12)*facet*view.environment.x;color+=fill;creaseColor+=fill;let pColor=mix(view.accentColor.rgb,view.highlightColor.rgb,0.18);color+=pColor*rippleLight*(0.85+fresnel*0.45);creaseColor+=pColor*rippleLight*1.35;let fog=mix(0.42,1.0,depthFog);let exposure=fog*view.material.z*view.effects.w;mapped=aces(color*exposure);mappedCrease=aces(creaseColor*exposure);shardAlpha=mix(0.58,0.97,depthFog);let seam=smoothstep(0.0,0.035,path.phase)*(1.0-smoothstep(0.965,1.0,path.phase));shardAlpha*=mix(1.0,seam,view.transport.y*view.formation.x*(1.0-view.gather.z));}
  var out:VertexOut;out.position=vec4f(ndc,depth2,1.0);out.baseAlpha=vec4f(mapped,shardAlpha);out.creaseColor=mappedCrease-mapped;out.localCoord=shapeLocal.xy;return out;}
@fragment fn fs_main(in:VertexOut)->@location(0) vec4f{let crease=(1.0-smoothstep(0.015,0.11,abs(in.localCoord.x)))*(1.0-smoothstep(0.78,1.0,abs(in.localCoord.y)));var coverage=1.0;if(view.effects.y>0.001){let dD=1.0-abs(in.localCoord.y)-abs(in.localCoord.x)/0.72;let eW=max(fwidth(dD)*view.effects.y,0.0001);coverage=smoothstep(0.0,eW,dD);}let mapped=in.baseAlpha.rgb+in.creaseColor*crease;let cA=in.baseAlpha.a*coverage;return vec4f(mapped*cA,cA);}
`;

const BLOOM_SHADER = `
struct PostParams{viewport:vec4f,bloomInfo:vec4f,finishing:vec4f,background:vec4f,temporal:vec4f,tint:vec4f,}
@group(0)@binding(0) var sceneTexture:texture_2d<f32>;@group(0)@binding(1) var sceneSampler:sampler;@group(0)@binding(2) var<uniform> post:PostParams;
fn visibleResidual(uv:vec2f)->vec4f{let scene=textureSampleLevel(sceneTexture,sceneSampler,uv,0.0).rgb;let residual=scene-post.background.rgb;let energy=dot(abs(residual),vec3f(0.2126,0.7152,0.0722));let threshold=post.bloomInfo.z;let knee=post.bloomInfo.w;let contribution=smoothstep(threshold-knee,threshold+knee,energy);let coverage=energy*contribution;return vec4f(mix(residual*contribution,post.tint.rgb*coverage,post.finishing.w),coverage);}
@fragment fn fs_main(@location(0) uv:vec2f)->@location(0) vec4f{let offset=post.bloomInfo.xy*0.25;var glow=visibleResidual(uv+offset);glow+=visibleResidual(uv-offset);glow+=visibleResidual(uv+vec2f(offset.x,-offset.y));glow+=visibleResidual(uv+vec2f(-offset.x,offset.y));return glow*0.25;}
`;

const BLOOM_BLUR_SHADER = `
struct BlurParams{direction:vec4f,}
@group(0)@binding(0) var bloomTexture:texture_2d<f32>;@group(0)@binding(1) var linearSampler:sampler;@group(0)@binding(2) var<uniform> blur:BlurParams;
@fragment fn fs_main(@location(0) uv:vec2f)->@location(0) vec4f{let n=blur.direction.xy*1.3846153846;let f=blur.direction.xy*3.2307692308;var c=textureSampleLevel(bloomTexture,linearSampler,uv,0.0)*0.2270270270;c+=textureSampleLevel(bloomTexture,linearSampler,uv+n,0.0)*0.3162162162;c+=textureSampleLevel(bloomTexture,linearSampler,uv-n,0.0)*0.3162162162;c+=textureSampleLevel(bloomTexture,linearSampler,uv+f,0.0)*0.0702702703;c+=textureSampleLevel(bloomTexture,linearSampler,uv-f,0.0)*0.0702702703;return c;}
`;

const FINISH_SHADER = `
struct PostParams{viewport:vec4f,bloomInfo:vec4f,finishing:vec4f,background:vec4f,temporal:vec4f,tint:vec4f,}
@group(0)@binding(0) var sceneTexture:texture_2d<f32>;@group(0)@binding(1) var bloomTexture:texture_2d<f32>;@group(0)@binding(2) var linearSampler:sampler;@group(0)@binding(3) var<uniform> post:PostParams;
fn hash12(v:vec2f)->f32{let p=fract(v*vec2f(0.1031,0.1030));let m=p+dot(p,p.yx+33.33);return fract((m.x+m.y)*m.x);}
@fragment fn fs_main(@location(0) uv:vec2f,@builtin(position) pixel:vec4f)->@location(0) vec4f{let bg=post.background.rgb;var scene=textureLoad(sceneTexture,vec2i(pixel.xy),0).rgb;if(post.finishing.z>0.000001){let aspect=post.viewport.x/max(post.viewport.y,1.0);let centered=(uv-vec2f(0.5))*vec2f(aspect,1.0);let radius=clamp(length(centered)/0.78,0.0,1.0);let rDir=centered/max(length(centered),0.0001);let minRes=min(post.viewport.x,post.viewport.y);let pOff=rDir*(post.finishing.z*minRes*radius*radius);let uvOff=pOff*post.viewport.zw;let pos=textureSampleLevel(sceneTexture,linearSampler,uv+uvOff,0.0).rgb;let neg=textureSampleLevel(sceneTexture,linearSampler,uv-uvOff,0.0).rgb;scene=vec3f(pos.r,scene.g,neg.b);}var fg=scene-bg;if(post.finishing.x>0.0001){let bloom=textureSampleLevel(bloomTexture,linearSampler,uv,0.0);let haloMask=1.0-smoothstep(0.04,0.4,length(fg));let haloOp=min(bloom.a*post.finishing.x*1.8,0.65)*haloMask;let haloColor=bloom.rgb/max(bloom.a,0.00001);let lightFG=mix(fg,haloColor-bg,haloOp);fg=mix(fg+bloom.rgb*post.finishing.x,lightFG,post.finishing.w);}let signal=smoothstep(0.008,0.18,length(fg));if(post.finishing.y>0.0001){let grainSeed=floor(post.temporal.x*60.0);let noise=hash12(floor(pixel.xy)+vec2f(grainSeed,grainSeed*1.6180339))-0.5;fg+=vec3f(noise*post.finishing.y*signal);}return vec4f(clamp(bg+fg,vec3f(0.0),vec3f(1.0)),1.0);}
`;

/* ─── render graph (identical logic, typed) ─────────────────── */
const createRenderGraph = (gpu: any, outputSize: number[], bloomSize: [number,number] = resolveBloomSize(outputSize)) => {
  const viewParams = uniforms(gpu, { viewport:[1,0.0132,1,0], shape:[1,1,0.36,0], effects:[1,2,1,1.12], composition:[0,0,0,1], transport:[0,0,0,0], formation:[1,0,0,0], gather:[0,0,0,0], pointer:[0,0,0.54,0], shock:[0,0,4,0], shockB:[0,0,0,0], shockC:[0,0,0,0], shockD:[0,0,0,0], material:[0.46,MATERIALS.pearl,0.92,0.54], light:[-0.321,0.49,0.845,0], environment:[0,0,0,0], baseColor:[137/255,106/255,189/255,1], highlightColor:mixColor([168/255,85/255,247/255,1],[1,1,1,1],MATERIAL_PRESETS.pearl.highlightMix), accentColor:[168/255,85/255,247/255,1] });
  const postParams = uniforms(gpu, { viewport:[outputSize[0],outputSize[1],1/outputSize[0],1/outputSize[1]], bloomInfo:[1/bloomSize[0],1/bloomSize[1],0.2,0.12], finishing:[0.5,0.05,0.0075,0], background:[0.071,0.059,0.09,1], temporal:[0,0,0,0], tint:[137/255,106/255,189/255,1] });
  const shardDraw = draw(gpu, { shader:SHARD_SHADER, vertices:6, blend:'premultiplied', cull:'none', depth:false, label:'aero-shards-procedural' });
  shardDraw.set({ view: viewParams });
  const sceneTarget = target(gpu, { size:outputSize as [number,number], format:'rgba8unorm', label:'aero-shards-scene' });
  const bloomTarget = target(gpu, { size:bloomSize, format:'rgba16float', label:'aero-shards-bloom' });
  const bloomScratchTarget = target(gpu, { size:bloomSize, format:'rgba16float', label:'aero-shards-bloom-scratch' });
  const linearSampler_ = sampler(gpu, { minFilter:'linear', magFilter:'linear', addressModeU:'clamp-to-edge', addressModeV:'clamp-to-edge' });
  const bloomEffect = effect(gpu, BLOOM_SHADER, { label:'aero-shards-bloom-prefilter', set:{ sceneTexture:sceneTarget, sceneSampler:linearSampler_, post:postParams } });
  const blurParamsX = uniforms(gpu, { direction:[1/bloomSize[0],0,0,0] });
  const blurParamsY = uniforms(gpu, { direction:[0,1/bloomSize[1],0,0] });
  const bloomBlurX = effect(gpu, BLOOM_BLUR_SHADER, { label:'aero-shards-bloom-horizontal', set:{ bloomTexture:bloomTarget, linearSampler:linearSampler_, blur:blurParamsX } });
  const bloomBlurY = effect(gpu, BLOOM_BLUR_SHADER, { label:'aero-shards-bloom-vertical', set:{ bloomTexture:bloomScratchTarget, linearSampler:linearSampler_, blur:blurParamsY } });
  const finishEffect = effect(gpu, FINISH_SHADER, { label:'aero-shards-finish', set:{ sceneTexture:sceneTarget, bloomTexture:bloomTarget, linearSampler:linearSampler_, post:postParams } });
  const styleTarget = target(gpu, { size:[1,1], format:'rgba8unorm', label:'aero-shards-style' });
  const asciiTarget = target(gpu, { size:[1,1], format:'rgba8unorm', label:'aero-shards-ascii-cells' });
  const styleParams = uniforms(gpu, { viewport:[outputSize[0],outputSize[1],6,10], background:[0.071,0.059,0.09,1], mode:[0,0,0,0] });
  return { viewParams, postParams, shardDraw, sceneTarget, bloomTarget, bloomScratchTarget, bloomEffect, blurParamsX, blurParamsY, bloomBlurX, bloomBlurY, finishEffect, styleTarget, asciiTarget, styleParams, styleSignature:'' };
};

const prepareRenderGraph = async (graph: any, outputFormat: string) => {
  await Promise.all([
    graph.shardDraw.compile({ colors:[outputFormat] }),
    graph.shardDraw.compile(graph.sceneTarget),
    graph.bloomEffect.compile(graph.bloomTarget),
    graph.bloomBlurX.compile(graph.bloomScratchTarget),
    graph.bloomBlurY.compile(graph.bloomTarget),
    graph.finishEffect.compile({ colors:[outputFormat] }),
  ]);
};

/* ─── component props ────────────────────────────────────────── */
interface AeroShardsProps {
  backgroundColor?: string; shardColor?: string; accentColor?: string;
  placement?: string; flow?: string; material?: string; detail?: string; effect?: string;
  scale?: number; spread?: number; depth?: number; speed?: number; spin?: number;
  interaction?: string; density?: number; shardSize?: number; stretch?: number;
  turbulence?: number; glow?: number; edgeSoftness?: number; bloom?: number;
  grain?: number; chromaticAberration?: number; transitionDuration?: number;
  interactionRadius?: number; interactionStrength?: number; rippleIntensity?: number;
  holdToGather?: boolean; paused?: boolean; className?: string;
  onError?: (e: Error) => void;
}

export default function AeroShards({
  backgroundColor='#120F17', shardColor='#896ABD', accentColor='#A855F7',
  placement='full', flow='stream', material='pearl', detail='balanced', effect='none',
  scale=1, spread=1, depth=1, speed=1, spin=1, interaction='repel',
  density=1.5, shardSize=1.1, stretch=1, turbulence=1, glow=1, edgeSoftness=2,
  bloom=0.5, grain=0.05, chromaticAberration=0.0075, transitionDuration=1,
  interactionRadius=1.5, interactionStrength=0.5, rippleIntensity=1,
  holdToGather=true, paused=false, className='', onError,
}: AeroShardsProps) {
  const rootRef    = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const onErrorRef = useRef(onError);
  const settingsRef = useRef<any>(null);
  const wakeRef    = useRef(() => {});
  const pointerRef = useRef({ raw:[0.5,0.5], position:[0.5,0.5], velocity:[0,0], active:0, presence:0, presenceVelocity:0, initialized:false });
  const ripplesRef = useRef(createRipples());
  const holdRef    = useRef(createHold());
  const [ready, setReady] = useState(false);

  const resolvedMaterial   = MATERIAL_PRESETS[material]  || MATERIAL_PRESETS.pearl;
  const resolvedDetail     = DETAIL_PRESETS[detail]      || DETAIL_PRESETS.balanced;
  const resolvedEffect     = (EFFECTS as any)[effect]    ?? EFFECTS.none;
  const effectDetail       = resolvedEffect === EFFECTS.none ? 1 : 0.4;
  const effectSize         = resolvedEffect === EFFECTS.none ? 1 : 1.75;
  const resolvedScale      = clamp(scale, 0.5, 2.5);
  const resolvedBackground = parseColor(backgroundColor, '#120F17');
  const resolvedShardColor = parseColor(shardColor, '#896ABD');
  const resolvedAccentColor= parseColor(accentColor, '#A855F7');
  const resolvedSpread     = clamp(spread, 0.15, 1.1);
  const resolvedDepth      = clamp(depth, 0, 1.25);
  const resolvedSpeed      = clamp(speed, 0, 2);
  const resolvedSpin       = clamp(spin, 0, 2);
  const resolvedInteraction= (INTERACTIONS as any)[interaction] ?? INTERACTIONS.repel;
  const resolvedDensity    = clamp(density, 0.5, 1.5);
  const resolvedShardSize  = clamp(shardSize, 0.5, 1.5);
  const resolvedStretch    = clamp(stretch, 0.6, 1.8);
  const resolvedTurbulence = clamp(turbulence, 0, 2);
  const resolvedGlow       = clamp(glow, 0, 2);
  const resolvedEdgeSoft   = clamp(edgeSoftness, 0, 2);
  const resolvedBloom      = clamp(bloom, 0, 3);
  const resolvedGrain      = clamp(grain, 0, 0.12);
  const resolvedCA         = clamp(chromaticAberration, 0, 0.01);
  const resolvedTransition = clamp(transitionDuration, 0.2, 2);
  const resolvedIntRadius  = clamp(interactionRadius, 0.5, 2);
  const resolvedIntStrength= clamp(interactionStrength, 0, 2);
  const bgLuma = resolvedBackground[0]*0.2126+resolvedBackground[1]*0.7152+resolvedBackground[2]*0.0722;
  const lightBg = clamp((bgLuma-0.58)/0.24,0,1);
  const lightSurface = lightBg*lightBg*(3-2*lightBg);

  settingsRef.current = {
    background: resolvedBackground, shard: resolvedShardColor,
    highlight: mixColor(resolvedAccentColor,[1,1,1,1],resolvedMaterial.highlightMix),
    accent: resolvedAccentColor,
    composition: (PLACEMENTS as any)[placement] ?? PLACEMENTS.full,
    flow: (FLOWS as any)[flow] ?? FLOWS.stream,
    material: (MATERIALS as any)[material] ?? MATERIALS.pearl,
    effect: resolvedEffect,
    detailCount: resolvedDetail.count*resolvedDensity*effectDetail,
    shardSize: resolvedDetail.size*resolvedShardSize*effectSize,
    scale: resolvedScale, stretch: resolvedStretch*(1+Math.min(resolvedSpeed*0.34,1.2)*0.1),
    speed: resolvedSpeed, spin: resolvedSpin, turbulence: 0.36*resolvedTurbulence,
    spread: resolvedSpread, depth: resolvedDepth,
    roughness: resolvedMaterial.roughness, brightness: resolvedMaterial.brightness,
    glow: resolvedMaterial.glow*resolvedGlow, edgeSoftness: resolvedEdgeSoft,
    bloom: resolvedBloom, grain: resolvedGrain,
    chromaticAberration: resolvedCA*(resolvedEffect===EFFECTS.none?1:0.2),
    exposure: 1.12+(0.96-1.12)*lightSurface, lightSurface,
    transitionDuration: resolvedTransition, interaction: resolvedInteraction,
    interactionRadius: (interaction==='attract'?0.27:0.18)*resolvedIntRadius,
    interactionStrength: resolvedIntStrength,
    rippleIntensity: clamp(rippleIntensity,0,2), holdToGather, paused,
    signature: [backgroundColor,shardColor,accentColor,placement,flow,material,detail,effect,resolvedScale,resolvedSpread,resolvedDepth,resolvedSpeed,resolvedSpin,interaction,resolvedDensity,resolvedShardSize,resolvedStretch,resolvedTurbulence,resolvedGlow,resolvedEdgeSoft,resolvedBloom,resolvedGrain,resolvedCA,resolvedTransition,resolvedIntRadius,resolvedIntStrength,rippleIntensity,holdToGather,paused].join('|'),
  };
  const settingsSignature = settingsRef.current.signature;
  onErrorRef.current = onError;

  useEffect(() => { wakeRef.current(); }, [settingsSignature]);

  useEffect(() => {
    const canvas = canvasRef.current, root = rootRef.current;
    if (!canvas || !root) return;
    resetPointerMotion(pointerRef.current);
    ripplesRef.current = createRipples();
    holdRef.current = createHold();

    let disposed=false, runtimeFailed=false, gpu: any;
    let animationFrameId=0, timeoutId=0;
    let unsubscribeResize: (()=>void)|undefined, unsubscribeGpuError: (()=>void)|undefined;
    let visibilityObserver: IntersectionObserver|undefined, resizeObserver: ResizeObserver|undefined;
    let visible=true, visibilityRatio=1, needsRender=true;
    let interactionDeadline=0, settlingDeadline=0;
    let bounds=root.getBoundingClientRect(), boundsDirty=false, resumePending=true;
    let wakeRenderer=()=>{ needsRender=true; };
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

    const reportFailure=(error: unknown)=>{ if(disposed||runtimeFailed) return; runtimeFailed=true; if(animationFrameId) cancelAnimationFrame(animationFrameId); if(timeoutId) window.clearTimeout(timeoutId); resizeObserver?.disconnect(); visibilityObserver?.disconnect(); unsubscribeResize?.(); unsubscribeGpuError?.(); const fg=gpu; gpu=undefined; fg?.dispose(); onErrorRef.current?.(error instanceof Error?error:new Error(String(error))); };
    const updateBounds=()=>{ bounds=root.getBoundingClientRect(); boundsDirty=false; };
    const pointFromClient=(cx: number,cy: number)=>{ if(boundsDirty) updateBounds(); if(bounds.width<=0||bounds.height<=0) return null; const x=(cx-bounds.left)/bounds.width,y=(cy-bounds.top)/bounds.height; if(x<0||x>1||y<0||y>1) return null; return [x,y]; };
    const updatePointerTarget=(next: number[])=>{ const p=pointerRef.current; if(!p.initialized||(!p.active&&p.presence===0)){p.raw=[...next];p.position=[...next];p.presence=0;resetPointerMotion(p);p.initialized=true;}else{p.raw[0]=next[0];p.raw[1]=next[1];}p.active=1; };
    const deactivatePointer=()=>{ pointerRef.current.active=0; holdRef.current.pointerId=null; const now=performance.now(); interactionDeadline=now+140; settlingDeadline=now+680; wakeRenderer(); };
    const handlePointerMove=(e: PointerEvent)=>{ const s=settingsRef.current; if(!e.isPrimary||!visible||s.interaction===INTERACTIONS.none) return; const next=pointFromClient(e.clientX,e.clientY); if(!next){const p=pointerRef.current;if(p.active||p.presence>0) deactivatePointer();return;} updatePointerTarget(next); const now=performance.now(); interactionDeadline=now+140; settlingDeadline=now+680; wakeRenderer(); };
    const handlePointerDown=(e: PointerEvent)=>{ const s=settingsRef.current; if(!e.isPrimary||e.button!==0||!visible||s.interaction===INTERACTIONS.none) return; if(e.target instanceof Element&&e.target.closest('a,button,input,textarea,select,[role="button"],[contenteditable="true"]')) return; const next=pointFromClient(e.clientX,e.clientY); if(!next) return; if(!s.paused&&!reduceMotion.matches&&s.speed>0.0001){startRipple(ripplesRef.current,next,bounds.width/Math.max(bounds.height,1));if(s.holdToGather){holdRef.current.pointerId=e.pointerId;holdRef.current.elapsed=0;}}  updatePointerTarget(next); const now=performance.now(); interactionDeadline=now+220; settlingDeadline=now+800; wakeRenderer(); };
    const handlePointerEnd=(e: PointerEvent)=>{ const hold=holdRef.current; if(hold.pointerId===e.pointerId){hold.pointerId=null;const s=settingsRef.current;if(hold.amount>0.1&&!s.paused&&!reduceMotion.matches&&s.interaction!==INTERACTIONS.none){startRipple(ripplesRef.current,pointerRef.current.raw,bounds.width/Math.max(bounds.height,1),1+hold.amount*0.8);}wakeRenderer();}if(e.pointerType!=='mouse') deactivatePointer(); };
    const markBoundsDirty=()=>{ boundsDirty=true; };
    const handleVisibilityChange=()=>{ resumePending=true; holdRef.current.pointerId=null; resetPointerMotion(pointerRef.current); wakeRenderer(); };

    window.addEventListener('pointermove',handlePointerMove,{passive:true});
    window.addEventListener('pointerdown',handlePointerDown,{passive:true});
    window.addEventListener('pointerup',handlePointerEnd,{passive:true});
    window.addEventListener('pointercancel',deactivatePointer,{passive:true});
    window.addEventListener('blur',deactivatePointer);
    window.addEventListener('scroll',markBoundsDirty,{passive:true,capture:true});
    document.addEventListener('visibilitychange',handleVisibilityChange);
    window.addEventListener('focus',handleVisibilityChange);
    reduceMotion.addEventListener('change',handleVisibilityChange);

    visibilityObserver=new IntersectionObserver(entries=>{ const e=entries[0]; visibilityRatio=e?.intersectionRatio??1; visible=e?e.isIntersecting&&visibilityRatio>=0.02:true; if(visible){resumePending=true;}else{interactionDeadline=0;settlingDeadline=0;const p=pointerRef.current;p.active=0;p.presence=0;holdRef.current.pointerId=null;resetPointerMotion(p);}wakeRenderer(); },{threshold:[0,0.02,0.25]});
    visibilityObserver.observe(root);

    void (async()=>{
      try {
        setReady(false);
        const resolvedQuality=resolveQuality(canvas);
        const preset=QUALITY_PRESETS[resolvedQuality]||QUALITY_PRESETS.medium;
        gpu=await init({powerPreference:'low-power'});
        if(disposed) return gpu.dispose();
        unsubscribeGpuError=gpu.onError(reportFailure);
        const outputFormat=navigator.gpu.getPreferredCanvasFormat();
        const output=surface(gpu,canvas,{dpr:resolveDpr(preset,canvas),autoResize:false,format:outputFormat});
        const graph=createRenderGraph(gpu,[...output.size],resolveBloomSize([canvas.clientWidth,canvas.clientHeight]));
        await prepareRenderGraph(graph,outputFormat);
        if(disposed) return;

        let lastSettingsSignature='', previousRenderTimestamp=0, lastPresentationTimestamp=0, nextPresentationTimestamp=0;
        let flowDistance=0, travelPhase=0, grainTime=0, firstFrame=true;
        const placementMotion=createFormation(settingsRef.current.composition);
        let layoutWeights=placementMotion.weights, layoutTransitioning=false;
        const formation=createFormation(settingsRef.current.flow);
        let renderScale=settingsRef.current.scale, runtimeQualityLevel=0, appliedBloomLevel=0, pendingBloomResize=false;
        let pressureStartedAt=0, stableStartedAt=performance.now(), lastQualityChange=0, encodeAverage=0;
        let renderTimestamp=0, previousRafTimestamp=0, refreshInterval=1000/60;
        const refreshSamples=new Float32Array(30);
        let refreshSampleCount=0, refreshSampleIndex=0;

        const resolveFrameState=(now: number)=>{ const p=pointerRef.current; const pT=Math.abs(p.presence-p.active)>0.004; if(now<interactionDeadline||pT||ripplesRef.current.some(r=>r.strength>0)||layoutTransitioning||holdRef.current.pointerId!==null||holdRef.current.amount>0||formation.weights[settingsRef.current.flow]<1||Math.abs(settingsRef.current.scale-renderScale)>0.001) return FRAME_STATES.interactive; if(now<settlingDeadline) return FRAME_STATES.settling; if(visibilityRatio<0.25) return FRAME_STATES.partial; return FRAME_STATES.ambient; };

        const resizePostTargets=(qLevel=appliedBloomLevel)=>{ const w=Math.max(1,output.size[0]),h=Math.max(1,output.size[1]),bS=resolveBloomSize([canvas.clientWidth,canvas.clientHeight],qLevel); graph.sceneTarget.resize([w,h] as [number,number]); graph.bloomTarget.resize(bS); graph.bloomScratchTarget.resize(bS); graph.blurParamsX.set({direction:[1/bS[0],0,0,0]}); graph.blurParamsY.set({direction:[0,1/bS[1],0,0]}); graph.postParams.set({viewport:[w,h,1/w,1/h],bloomInfo:[1/bS[0],1/bS[1],0.2,0.12]}); };
        const resizeOutput=()=>{ updateBounds(); const dpr=resolveDpr(preset,canvas),nS=[Math.max(1,Math.round(canvas.clientWidth*dpr)),Math.max(1,Math.round(canvas.clientHeight*dpr))]; if(nS[0]!==output.size[0]||nS[1]!==output.size[1]) output.resize(nS as [number,number]); resizePostTargets(); };

        unsubscribeResize=output.onResize(()=>{ resizePostTargets(); needsRender=true; wakeRenderer(); });
        resizeObserver=new ResizeObserver(()=>{ resizeOutput(); wakeRenderer(); });
        resizeObserver.observe(canvas);

        const setRuntimeQuality=(nextLevel: number,now: number,frameState: any)=>{ const cl=Math.max(0,Math.min(RUNTIME_QUALITY.length-1,nextLevel)); if(cl===runtimeQualityLevel) return; runtimeQualityLevel=cl; pressureStartedAt=0; stableStartedAt=now; lastQualityChange=now; if(frameState===FRAME_STATES.interactive||frameState===FRAME_STATES.settling){pendingBloomResize=true;}else{appliedBloomLevel=runtimeQualityLevel;pendingBloomResize=false;resizePostTargets();} };

        const renderFrame=(currentFrame: any)=>{ const settings=settingsRef.current; const frozen=settings.paused||reduceMotion.matches||settings.speed<=0.0001; const elapsed=resumePending||!previousRenderTimestamp?0:Math.min(0.05,Math.max(0,(renderTimestamp-previousRenderTimestamp)/1000)); resumePending=false; previousRenderTimestamp=renderTimestamp; lastSettingsSignature=settings.signature; needsRender=false;
          if(!frozen){flowDistance+=elapsed*settings.speed*0.34;grainTime+=elapsed;}
          renderScale=frozen?settings.scale:renderScale+(settings.scale-renderScale)*(1-Math.exp(-elapsed*12));
          advanceFormation(placementMotion,settings.composition,elapsed,settings.transitionDuration,frozen); layoutWeights=placementMotion.weights; layoutTransitioning=layoutWeights[settings.composition]!==1;
          if(!frozen){const tA=output.size[0]/Math.max(output.size[1],1);travelPhase=(travelPhase+(elapsed*settings.speed*0.34)/resolvePathLength(tA,layoutWeights))%1;}
          const pointer=pointerRef.current; advanceFormation(formation,settings.flow,elapsed,settings.transitionDuration,frozen); advanceHold(holdRef.current,elapsed,frozen||!settings.holdToGather||settings.interaction===INTERACTIONS.none);
          if(settings.interaction===INTERACTIONS.none){pointer.active=0;pointer.presence=0;resetPointerMotion(pointer);}else if(frozen){pointer.position=[...pointer.raw];pointer.presence=pointer.active;resetPointerMotion(pointer);}else if(pointer.initialized){advancePointer(pointer,elapsed);}
          advanceRipples(ripplesRef.current,elapsed,frozen||settings.interaction===INTERACTIONS.none);
          const rQ=RUNTIME_QUALITY[runtimeQualityLevel]; const activeCount=Math.max(700,Math.round(preset.count*settings.detailCount*rQ.countScale)); const dC=Math.pow(1/rQ.countScale,0.2); const sWS=0.0125*settings.shardSize*dC; const aspect=output.size[0]/Math.max(output.size[1],1); const lP=settings.interaction===INTERACTIONS.none?0:pointer.presence; const pSX=(pointer.position[0]-0.5)*0.38*lP; const pSY=(pointer.position[1]-0.5)*-0.24*lP; const lX=-0.38+pSX; const lY=0.58+pSY; const lLen=Math.hypot(lX,lY,1); const iSign=settings.interaction===INTERACTIONS.attract?1:-1; const iP=settings.interaction===INTERACTIONS.none?0:pointer.presence*settings.interactionStrength*iSign*(1-holdRef.current.amount); const iS=1/renderScale; const pWX=((pointer.position[0]*2-1)*aspect)*iS; const pWY=(1-pointer.position[1]*2)*iS; const rU=ripplesRef.current.map(r=>[(r.origin[0]*2-1)*aspect*iS,(1-r.origin[1]*2)*iS,r.age,r.strength*settings.interactionStrength*settings.rippleIntensity*iS]);
          graph.viewParams.set({viewport:[aspect,sWS,renderScale,flowDistance],shape:[settings.spread,settings.depth,settings.turbulence,pSY],effects:[settings.spin,settings.edgeSoftness,settings.stretch,settings.exposure],composition:layoutWeights,transport:[travelPhase,Math.min(1,(1-Math.max(...layoutWeights))*12),0,0],formation:formation.weights,gather:[pWX,pWY,holdRef.current.amount,holdRef.current.phase],pointer:[pWX,pWY,settings.interactionRadius*2*iS,iP*iS],shock:rU[0],shockB:rU[1],shockC:rU[2],shockD:rU[3],material:[settings.roughness,settings.material,settings.brightness,settings.glow],light:[lX/lLen,lY/lLen,1/lLen,pSX],environment:[settings.lightSurface,0,0,0],baseColor:settings.shard,highlightColor:settings.highlight,accentColor:settings.accent});
          graph.postParams.set({finishing:[settings.bloom,settings.grain,settings.chromaticAberration,settings.lightSurface],background:settings.background,tint:mixColor(settings.shard,settings.accent,0.4),temporal:[grainTime,0,0,0]});
          const postEnabled=settings.effect!==EFFECTS.none||settings.bloom>0.0001||settings.grain>0.0001||settings.chromaticAberration>0.000001;
          if(!postEnabled){currentFrame.pass({target:output,clear:settings.background},( pass: any)=>{pass.draw(graph.shardDraw,{instances:activeCount});});}else{currentFrame.pass({target:graph.sceneTarget,clear:settings.background},(pass: any)=>{pass.draw(graph.shardDraw,{instances:activeCount});});if(settings.bloom>0.0001){currentFrame.pass({target:graph.bloomTarget,clear:[0,0,0,1]},(pass: any)=>{pass.draw(graph.bloomEffect);});currentFrame.pass({target:graph.bloomScratchTarget,clear:[0,0,0,1]},(pass: any)=>{pass.draw(graph.bloomBlurX);});currentFrame.pass({target:graph.bloomTarget,clear:[0,0,0,1]},(pass: any)=>{pass.draw(graph.bloomBlurY);});}currentFrame.pass({target:output,clear:settings.background},(pass: any)=>{pass.draw(graph.finishEffect);});}
          if(firstFrame){firstFrame=false;requestAnimationFrame(()=>{if(!disposed) setReady(true);});} };

        const scheduleRaf=()=>{ if(disposed||runtimeFailed||animationFrameId||!visible||document.hidden) return; animationFrameId=requestAnimationFrame(scheduleFrame); };
        const scheduleSleep=(ts: number)=>{ if(disposed||runtimeFailed||timeoutId||animationFrameId||!visible||document.hidden) return; const delay=Math.max(0,ts-performance.now()-10); timeoutId=window.setTimeout(()=>{timeoutId=0;scheduleRaf();},delay); };
        const scheduleFrame=(timestamp: number)=>{ animationFrameId=0; if(disposed||runtimeFailed||!visible||document.hidden) return;
          if(previousRafTimestamp){const rs=timestamp-previousRafTimestamp;if(rs>3&&rs<35){refreshSamples[refreshSampleIndex]=rs;refreshSampleIndex=(refreshSampleIndex+1)%refreshSamples.length;refreshSampleCount=Math.min(refreshSampleCount+1,refreshSamples.length);refreshInterval=refreshSamples[0];for(let i=1;i<refreshSampleCount;i++) refreshInterval=Math.min(refreshInterval,refreshSamples[i]);}}
          previousRafTimestamp=timestamp;
          const settings=settingsRef.current; const sC=settings.signature!==lastSettingsSignature; const frozen=settings.paused||reduceMotion.matches||settings.speed<=0.0001; if(frozen&&!firstFrame&&!sC&&!needsRender) return;
          const forceFrame=firstFrame||sC||!lastPresentationTimestamp; const frameState=resolveFrameState(performance.now()); const pInterval=resolveFrameInterval(frameState,refreshInterval); const cDeadline=lastPresentationTimestamp+pInterval; const dueTs=nextPresentationTimestamp?Math.min(nextPresentationTimestamp,cDeadline):cDeadline;
          if(!forceFrame&&timestamp<dueTs-0.5){if(frameState.continuous) scheduleRaf();else scheduleSleep(dueTs);return;}
          if(pendingBloomResize&&frameState!==FRAME_STATES.interactive&&frameState!==FRAME_STATES.settling){appliedBloomLevel=runtimeQualityLevel;pendingBloomResize=false;resizePostTargets();}
          renderTimestamp=timestamp; const encodeStart=performance.now();
          try{frame(gpu,renderFrame);}catch(error){reportFailure(error);return;}
          lastPresentationTimestamp=timestamp;
          const mNow=performance.now(); const eDur=mNow-encodeStart; encodeAverage=encodeAverage?encodeAverage*0.9+eDur*0.1:eDur; const sinceP=lastPresentationTimestamp?timestamp-lastPresentationTimestamp:Infinity; const missed=Number.isFinite(sinceP)&&sinceP>pInterval*1.65; const underPressure=encodeAverage>4||missed;
          if(underPressure){if(!pressureStartedAt) pressureStartedAt=mNow;}else{pressureStartedAt=0;}
          if(underPressure||frameState!==FRAME_STATES.ambient) stableStartedAt=mNow;
          const sustained=pressureStartedAt>0&&mNow-pressureStartedAt>1800; const cooldown=mNow-lastQualityChange>2200;
          if(runtimeQualityLevel<RUNTIME_QUALITY.length-1&&cooldown&&sustained){setRuntimeQuality(runtimeQualityLevel+1,mNow,frameState);}else if(runtimeQualityLevel>0&&frameState===FRAME_STATES.ambient&&!underPressure&&mNow-stableStartedAt>15000&&mNow-lastQualityChange>15000){setRuntimeQuality(runtimeQualityLevel-1,mNow,frameState);}
          const nextState=resolveFrameState(performance.now()); nextPresentationTimestamp=advanceFrameDeadline(timestamp,dueTs,resolveFrameInterval(nextState,refreshInterval),forceFrame||nextState.continuous!==frameState.continuous);
          if(frozen) return; if(nextState.continuous) scheduleRaf();else scheduleSleep(nextPresentationTimestamp); };

        wakeRenderer=()=>{ needsRender=true; if(!animationFrameId) nextPresentationTimestamp=0; if(timeoutId){window.clearTimeout(timeoutId);timeoutId=0;}scheduleRaf(); };
        wakeRef.current=wakeRenderer; wakeRenderer();
      } catch(error){ reportFailure(error); }
    })();

    return ()=>{
      disposed=true;
      window.removeEventListener('pointermove',handlePointerMove); window.removeEventListener('pointerdown',handlePointerDown); window.removeEventListener('pointerup',handlePointerEnd); window.removeEventListener('pointercancel',deactivatePointer); window.removeEventListener('blur',deactivatePointer); window.removeEventListener('scroll',markBoundsDirty,true); document.removeEventListener('visibilitychange',handleVisibilityChange); window.removeEventListener('focus',handleVisibilityChange); reduceMotion.removeEventListener('change',handleVisibilityChange);
      visibilityObserver?.disconnect(); resizeObserver?.disconnect(); unsubscribeResize?.(); unsubscribeGpuError?.();
      if(animationFrameId) cancelAnimationFrame(animationFrameId); if(timeoutId) window.clearTimeout(timeoutId);
      wakeRef.current=()=>{}; gpu?.dispose();
    };
  }, []);

  return (
    <div ref={rootRef} className={`aero-shards ${className}`} data-ready={ready} style={{backgroundColor}} aria-hidden="true">
      <canvas ref={canvasRef} className="aero-shards__canvas" />
    </div>
  );
}
