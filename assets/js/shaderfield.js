/* 41n portfolio — the full-screen WebGL "Stage".
   Reconstructed from captured frames of the real rendered page: a near-black
   volumetric space, a floating beveled glass slab with a cool blue internal
   gradient, two crossed orbital rings arcing beneath it, drifting particles
   on a curl flow and a pointer halo. A single full-screen triangle.
   uProgress (wheel-driven, no native scroll bar on the real site) pushes the
   camera through scenes. CSS gradient fallback when WebGL is unavailable. */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;     // 0..1
uniform float uProgress;  // 0..N scene float
uniform vec3  uBg;
uniform vec3  uAccent;
uniform vec3  uAccent2;

float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p){ float v=0.,a=.55; for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+11.3;a*=.5;} return v; }
vec2 curl(vec2 p){ float e=.09;
  float n1=noise(p+vec2(0.,e)),n2=noise(p-vec2(0.,e)),n3=noise(p+vec2(e,0.)),n4=noise(p-vec2(e,0.));
  return vec2(n1-n2,-(n3-n4))/(2.0*e); }

float sdRoundBox(vec2 p, vec2 b, float r){ vec2 d=abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

void main(){
  vec2 uv = gl_FragCoord.xy/uRes.xy;
  vec2 p = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  float t = uTime;
  vec3 col = uBg;

  // volumetric drifting space
  vec2 q = vec2(fbm(p*1.4+vec2(t*0.03,-t*0.02)), fbm(p*1.4+vec2(4.2,1.7)-t*0.025));
  float fog = fbm(p*1.1 + q*1.7 + vec2(0., uProgress*0.10));
  col += vec3(smoothstep(0.32,0.95,fog))*0.045;
  col += uAccent2 * smoothstep(0.55,1.0,fog) * 0.10;

  // particles on a curl flow
  vec2 gp=p*9.0+q*0.7; vec2 cell=floor(gp); vec2 local=fract(gp)-0.5;
  vec2 flow=curl(cell*0.18+vec2(t*0.04,-t*0.03));
  float seed=hash(cell); float breathe=0.5+0.5*sin(t*0.5+seed*6.2831);
  float d=length(local-flow*0.14); float rad=mix(0.02,0.06,seed);
  float parts=smoothstep(rad,rad*0.1,d)*(0.15+0.5*breathe);
  col += uAccent*parts*0.5;

  // pointer parallax (engine lerpSpeed .1 feel)
  vec2 m=uMouse-0.5;
  vec2 par=m*0.10;

  // scene morph: the home slab fades as the camera pushes into later scenes
  float homeVis=clamp(1.0-uProgress*1.15,0.0,1.0);
  float push=1.0+uProgress*0.22;
  vec2 sp=(p-par)*push;

  if(homeVis>0.001){
    float ang=sin(t*0.25)*0.06 - m.x*0.12;
    vec2 bp=rot(ang)*(sp-vec2(0.02,0.03));
    float sd=sdRoundBox(bp, vec2(0.115,0.165), 0.012);
    float slab=smoothstep(0.004,-0.002,sd);
    float gy=(bp.y+0.165)/0.33;
    // frosted steel-blue, muted (real slab is a soft blue panel, not neon)
    vec3 glass=mix(vec3(0.16,0.22,0.34), vec3(0.30,0.40,0.58), gy);
    glass+=uAccent*0.10;
    float edge=smoothstep(0.009,0.0,abs(sd+0.004));
    glass+=mix(uAccent,vec3(0.7,0.82,1.0),0.6)*edge*0.35;
    float sheen=smoothstep(0.30,0.46,bp.x+gy*0.18)-smoothstep(0.52,0.68,bp.x+gy*0.18);
    glass+=vec3(sheen)*0.06;
    col=mix(col, glass, slab*0.94*homeVis);
    col+=uAccent*smoothstep(0.14,0.0,abs(sd))*0.035*homeVis;
  }

  // crossed orbital rings arcing beneath the slab
  if(homeVis>0.001){
    for(int k=0;k<2;k++){
      float rA=(k==0)?0.785:-0.785;
      vec2 rp=rot(rA)*(sp-vec2(0.0,-0.10));
      rp.y*=3.1;
      float ring=abs(length(rp)-0.30);
      float arc=smoothstep(0.008,0.0,ring);
      arc*=smoothstep(0.30,-0.05,rp.y);
      col+=mix(uAccent,vec3(0.55,0.7,0.95),0.5)*arc*0.28*homeVis;
    }
  }

  // pointer halo
  vec2 mh=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  float md=length(p-mh);
  col+=uAccent*exp(-md*md*2.4)*0.10;

  col+=(hash(gl_FragCoord.xy+fract(t))-0.5)*0.010;
  col*=1.0-0.46*smoothstep(0.35,1.35,length(p));
  gl_FragColor=vec4(col,1.0);
}
`;

function compile(gl,type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){console.warn('[AT] shader',gl.getShaderInfoLog(sh));gl.deleteShader(sh);return null;}return sh;}
function hex2rgb(h,fb){const m=String(h||'').trim().match(/^#([0-9a-f]{3,8})$/i);if(!m)return fb;let s=m[1];
  if(s.length===3)s=s.split('').map(c=>c+c).join('');const v=[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255);return v.some(n=>isNaN(n))?fb:v;}

function createShaderField(canvas,opts={}){
  const scale=opts.scale??(window.devicePixelRatio>1.5?0.6:0.75);
  const onFail=opts.onFail;
  const gl=canvas.getContext('webgl',{antialias:false,alpha:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'low-power',preserveDrawingBuffer:false});
  const noop={ok:false,resize(){},frame(){},setMouse(){},setProgress(){},setPalette(){},destroy(){}};
  if(!gl){onFail&&onFail();return noop;}

  const vs=compile(gl,gl.VERTEX_SHADER,VERT),fs=compile(gl,gl.FRAGMENT_SHADER,FRAG);
  const prog=vs&&fs?gl.createProgram():null;
  if(prog){gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){console.warn('[AT] link',gl.getProgramInfoLog(prog));gl.deleteProgram(prog);}}
  if(!prog){onFail&&onFail();return noop;}
  gl.useProgram(prog);

  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const aPos=gl.getAttribLocation(prog,'aPos');gl.enableVertexAttribArray(aPos);gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);

  const U={res:gl.getUniformLocation(prog,'uRes'),time:gl.getUniformLocation(prog,'uTime'),
    mouse:gl.getUniformLocation(prog,'uMouse'),progress:gl.getUniformLocation(prog,'uProgress'),
    bg:gl.getUniformLocation(prog,'uBg'),accent:gl.getUniformLocation(prog,'uAccent'),accent2:gl.getUniformLocation(prog,'uAccent2')};

  let w=2,h=2,time=0,pg=0,dead=false;
  let bg=hex2rgb('#05070c',[0.02,0.027,0.047]);
  let ac=hex2rgb('#3aa0ff',[0.23,0.63,1.0]);
  let ac2=hex2rgb('#1A6DEA',[0.10,0.43,0.92]);
  let mouse=[0.5,0.5],target=[0.5,0.5];

  function uniforms(){gl.uniform3f(U.bg,bg[0],bg[1],bg[2]);gl.uniform3f(U.accent,ac[0],ac[1],ac[2]);gl.uniform3f(U.accent2,ac2[0],ac2[1],ac2[2]);}
  function draw(){gl.uniform1f(U.time,time);gl.uniform2f(U.mouse,mouse[0],mouse[1]);gl.uniform1f(U.progress,pg);gl.drawArrays(gl.TRIANGLES,0,3);}
  function resize(){if(dead)return;const rect=canvas.getBoundingClientRect();const cw=Math.max(1,rect.width||window.innerWidth),ch=Math.max(1,rect.height||window.innerHeight);
    const dpr=Math.min(window.devicePixelRatio||1,1.75);const nw=Math.max(2,Math.round(cw*dpr*scale)),nh=Math.max(2,Math.round(ch*dpr*scale));
    if(nw===w&&nh===h)return;w=nw;h=nh;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);gl.uniform2f(U.res,w,h);draw();}
  function setMouse(x,y){target[0]=Math.min(1,Math.max(0,x/window.innerWidth));target[1]=Math.min(1,Math.max(0,1-y/window.innerHeight));}
  function setProgress(p){pg=p;}
  function setPalette(b,a,a2){if(b)bg=hex2rgb(b,bg);if(a)ac=hex2rgb(a,ac);if(a2)ac2=hex2rgb(a2,ac2);uniforms();}
  function frame(dt){if(dead)return;time+=Math.min(dt,0.05);
    const al=1-Math.pow(1-0.10,Math.max(0.01,dt*60));mouse[0]+=(target[0]-mouse[0])*al;mouse[1]+=(target[1]-mouse[1])*al;draw();}
  function destroy(){dead=true;try{gl.deleteBuffer(buf);gl.deleteProgram(prog);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();}catch(e){}}

  uniforms();gl.uniform1f(U.time,0);gl.uniform1f(U.progress,0);gl.uniform2f(U.mouse,0.5,0.5);resize();
  return {ok:true,resize,frame,setMouse,setProgress,setPalette,destroy};
}
window.createShaderField=createShaderField;
