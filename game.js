'use strict';
// ---------- Map: # wall, L locked door, X exit door, P start, K key, R relic, b battery
const MAP=[
"###################",
"#P...#.......#....#",
"#....#...K...#..R.#",
"#....#.......#....#",
"#..b.#.......#....#",
"##.####.#######L###",
"#"+".".repeat(17)+"X",
"##.####.#######L###",
"#....#.......#....#",
"#.K..#...R...#..R.#",
"#....#..b....#....#",
"###################"];
const CS=4,H=3.2,RAD=.35,W=MAP[0].length,HT=MAP.length;
const $=id=>document.getElementById(id);
const cell=v=>Math.floor(v/CS), ctr=v=>(v+.5)*CS;

// ---------- Renderer / scene
const canvas=$('c'),ren=new THREE.WebGLRenderer({canvas,antialias:true});
ren.shadowMap.enabled=true;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x020203);
scene.fog=new THREE.FogExp2(0x020203,.1);
const cam=new THREE.PerspectiveCamera(75,1,.1,60);scene.add(cam);
function resize(){ren.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

function tex(base,fn,rx,ry){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,128,128);
 for(let i=0;i<900;i++){g.fillStyle='rgba(0,0,0,'+Math.random()*.3+')';g.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*3,1+Math.random()*3)}
 fn(g);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);return t}
const wallM=new THREE.MeshStandardMaterial({map:tex('#4d4439',g=>{g.fillStyle='rgba(20,10,0,.25)';for(let i=0;i<8;i++)g.fillRect(Math.random()*128,0,2+Math.random()*4,128)},2,1.6),roughness:.95});
const floorM=new THREE.MeshStandardMaterial({map:tex('#2e2016',g=>{g.fillStyle='#120a05';for(let y=0;y<128;y+=32)g.fillRect(0,y,128,2)},W*2,HT*2),roughness:.9});
const ceilM=new THREE.MeshStandardMaterial({color:0x1b1712,roughness:1});
const fl=new THREE.Mesh(new THREE.PlaneGeometry(W*CS,HT*CS),floorM);fl.rotation.x=-Math.PI/2;fl.position.set(W*CS/2,0,HT*CS/2);fl.receiveShadow=true;scene.add(fl);
const ce=new THREE.Mesh(new THREE.PlaneGeometry(W*CS,HT*CS),ceilM);ce.rotation.x=Math.PI/2;ce.position.set(W*CS/2,H,HT*CS/2);scene.add(ce);
const wallG=new THREE.BoxGeometry(CS,H,CS);
MAP.forEach((r,z)=>[...r].forEach((ch,x)=>{if(ch==='#'){const m=new THREE.Mesh(wallG,wallM);m.position.set(ctr(x),H/2,ctr(z));m.castShadow=m.receiveShadow=true;scene.add(m)}}));
scene.add(new THREE.AmbientLight(0x20243a,.3));
const lamps=[[4,6],[10,6],[15,6],[9,2],[9,9]].map(([x,z])=>{const l=new THREE.PointLight(0xff9a55,.5,10);l.position.set(ctr(x),2.7,ctr(z));scene.add(l);return l});
const spot=new THREE.SpotLight(0xfff2d0,2.6,24,.5,.5,1.4);spot.castShadow=true;spot.shadow.mapSize.set(512,512);spot.shadow.camera.near=.3;
spot.target.position.set(0,0,-1);cam.add(spot,spot.target);

// ---------- Monster
const mon=new THREE.Group(),dark=new THREE.MeshStandardMaterial({color:0x0b0b0b,roughness:1}),eyeM=new THREE.MeshBasicMaterial({color:0xff1010});
const add=(g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;mon.add(o);return o};
add(new THREE.CylinderGeometry(.3,.42,1.7,10),dark,0,.95,0);add(new THREE.SphereGeometry(.27,12,10),dark,0,2,0);
add(new THREE.BoxGeometry(.12,1.5,.12),dark,-.5,1.1,.15);add(new THREE.BoxGeometry(.12,1.5,.12),dark,.5,1.1,.15);
add(new THREE.SphereGeometry(.05),eyeM,-.1,2.03,.23);add(new THREE.SphereGeometry(.05),eyeM,.1,2.03,.23);
const eyeL=new THREE.PointLight(0xff0000,.8,7);eyeL.position.set(0,1.9,.3);mon.add(eyeL);scene.add(mon);

// ---------- Game state
const P={x:0,z:0},M={x:0,z:0,mode:'patrol',path:[],rep:0,lose:0,cool:0,stun:0};
let yaw=0,pitch=0,hp=100,bat=100,keys=0,rel=0,flashOn=true,state='menu',walk=0,stepAcc=0,beat=0,msg='',msgT=0,dmgF=0;
let closed=new Set(),doors=[],items=[],cur=null;const dyn=new THREE.Group();scene.add(dyn);
const solid=(x,z)=>x<0||z<0||x>=W||z>=HT||MAP[z][x]==='#'||closed.has(x+','+z);

function mkItem(t,x,z){let m;
 if(t==='K'){m=new THREE.Group();const g=new THREE.MeshStandardMaterial({color:0xd4a017,emissive:0x442a00,metalness:.8,roughness:.3});
  const a=new THREE.Mesh(new THREE.TorusGeometry(.12,.04,8,16),g);a.position.x=-.2;m.add(a,new THREE.Mesh(new THREE.BoxGeometry(.4,.06,.06),g))}
 else if(t==='R'){m=new THREE.Mesh(new THREE.IcosahedronGeometry(.25),new THREE.MeshStandardMaterial({color:0x7a00ff,emissive:0x5500cc,emissiveIntensity:1.3}));
  const l=new THREE.PointLight(0x8844ff,.9,6);m.add(l)}
 else m=new THREE.Mesh(new THREE.BoxGeometry(.2,.35,.2),new THREE.MeshStandardMaterial({color:0x22cc66,emissive:0x118833}));
 m.position.set(ctr(x),1,ctr(z));dyn.add(m);items.push({t,m,x:ctr(x),z:ctr(z)})}

function reset(){
 dyn.clear();items=[];doors=[];closed=new Set();hp=100;bat=100;keys=0;rel=0;flashOn=true;msg='';dmgF=0;
 MAP.forEach((r,z)=>[...r].forEach((ch,x)=>{
  if(ch==='P'){P.x=ctr(x);P.z=ctr(z)}
  if('KRb'.includes(ch))mkItem(ch,x,z);
  if(ch==='L'||ch==='X'){closed.add(x+','+z);
   const span=solid(x-1,z)&&solid(x+1,z)&&ch==='L'||(ch==='L'&&MAP[z][x-1]==='#');
   const m=new THREE.Mesh(span?new THREE.BoxGeometry(CS,H,.3):new THREE.BoxGeometry(.3,H,CS),new THREE.MeshStandardMaterial(ch==='X'?{color:0x1d4a2c,emissive:0x0a3310}:{color:0x4a2a14,roughness:.9}));
   m.position.set(ctr(x),H/2,ctr(z));m.castShadow=m.receiveShadow=true;dyn.add(m);doors.push({ch,x,z,m})}}));
 M.x=ctr(15);M.z=ctr(6);M.mode='patrol';M.path=[];M.lose=0;M.cool=0;M.stun=0;yaw=-Math.PI/2*0;pitch=0}

// ---------- Collision (circle vs wall cells)
function hit(px,pz){for(let z=cell(pz-RAD);z<=cell(pz+RAD);z++)for(let x=cell(px-RAD);x<=cell(px+RAD);x++)if(solid(x,z)){
 const cx=Math.max(x*CS,Math.min(px,(x+1)*CS)),cz=Math.max(z*CS,Math.min(pz,(z+1)*CS));if((px-cx)**2+(pz-cz)**2<RAD*RAD)return true}return false}
function tryMove(dx,dz){if(!hit(P.x+dx,P.z))P.x+=dx;if(!hit(P.x,P.z+dz))P.z+=dz}

// ---------- Monster AI
function bfs(sx,sz,tx,tz){const k=(x,z)=>z*W+x,prev=new Map([[k(sx,sz),-1]]),q=[[sx,sz]];
 for(let i=0;i<q.length;i++){const [x,z]=q[i];if(x===tx&&z===tz){const p=[];let c=k(x,z);while(prev.get(c)!==-1){p.unshift([c%W,(c/W)|0]);c=prev.get(c)}return p}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,c=k(nx,nz);if(!solid(nx,nz)&&!prev.has(c)){prev.set(c,k(x,z));q.push([nx,nz])}}}return null}
function los(ax,az,bx,bz){const n=Math.ceil(Math.hypot(bx-ax,bz-az)/.5);for(let i=1;i<n;i++){const t=i/n;if(solid(cell(ax+(bx-ax)*t),cell(az+(bz-az)*t)))return false}return true}
function updMonster(dt,run,t){
 const d=Math.hypot(P.x-M.x,P.z-M.z),seen=d<14&&los(M.x,M.z,P.x,P.z),heard=(run&&d<9)||d<2.5;
 if(seen||heard){if(M.mode!=='chase'){growl()}M.mode='chase';M.lose=0}else if(M.mode==='chase'){M.lose+=dt;if(M.lose>4){M.mode='patrol';M.path=[]}}
 M.rep-=dt;M.cool-=dt;M.stun-=dt;
 if(M.mode==='chase'&&M.rep<=0){M.rep=.3;M.path=bfs(cell(M.x),cell(M.z),cell(P.x),cell(P.z))||[]}
 if(M.mode==='patrol'&&!M.path.length)M.path=bfs(cell(M.x),cell(M.z),1+(Math.random()*(W-2)|0),1+(Math.random()*(HT-2)|0))||[];
 let tx,tz;if(M.path.length>1||(M.mode==='patrol'&&M.path.length)){tx=ctr(M.path[0][0]);tz=ctr(M.path[0][1])}else if(M.mode==='chase'){tx=P.x;tz=P.z}
 if(tx!==undefined&&M.stun<=0){const dx=tx-M.x,dz=tz-M.z,dd=Math.hypot(dx,dz)||1,sp=(M.mode==='chase'?4.2:1.7)*dt;M.x+=dx/dd*Math.min(sp,dd);M.z+=dz/dd*Math.min(sp,dd);
  mon.rotation.y=Math.atan2(dx,dz);if(dd<.3&&M.path.length)M.path.shift()}
 mon.position.set(M.x,Math.sin(t*6)*.03,M.z);mon.rotation.z=Math.sin(t*4)*.04;
 if(d<1.15&&M.cool<=0){hp-=20;M.cool=1.3;M.stun=.6;dmgF=1;hurt()}
 return d}

// ---------- Audio (procedural, starts after click)
let AC,master,muted=false,nbuf;
function initAudio(){if(AC){AC.resume();return}AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=muted?0:.8;master.connect(AC.destination);
 nbuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=220;const g=AC.createGain();g.gain.value=.16;lp.connect(g);g.connect(master);
 [48,51.3].forEach((f,i)=>{const o=AC.createOscillator();o.type=i?'sawtooth':'sine';o.frequency.value=f;o.connect(lp);o.start()});
 setInterval(()=>{if(state==='play'&&Math.random()<.6)tone(120+Math.random()*80,1.2,'sawtooth',.05,60+Math.random()*40)},7000)}
function tone(f,d,ty='sine',v=.2,f2){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime;o.type=ty;o.frequency.setValueAtTime(f,n);if(f2)o.frequency.exponentialRampToValueAtTime(f2,n+d);
 g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(.001,n+d);o.connect(g);g.connect(master);o.start();o.stop(n+d)}
function hiss(d,v,fr){if(!AC)return;const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain(),n=AC.currentTime;s.buffer=nbuf;f.type='lowpass';f.frequency.value=fr;
 g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(.001,n+d);s.connect(f);f.connect(g);g.connect(master);s.start();s.stop(n+d)}
const growl=()=>tone(90,1,'sawtooth',.25,40),hurt=()=>{hiss(.3,.6,900);tone(70,.4,'square',.25,30)};
const pickS=()=>{tone(660,.15,'triangle',.2);setTimeout(()=>tone(990,.2,'triangle',.2),90)};
function setMute(m){muted=m;if(master)master.gain.value=m?0:.8;$('mute').textContent='Sound: '+(m?'Off':'On')}
$('mute').onclick=e=>{setMute(!muted);e.target.blur()};

// ---------- Input / UI
const K={};
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));if(id)$(id).classList.remove('hidden');$('hud').classList.toggle('hidden',!(state==='play'||state==='pause'))}
function start(){initAudio();reset();state='play';show(null);canvas.requestPointerLock()}
function pause(){if(state!=='play')return;state='pause';show('pause')}
function end(win){state=win?'win':'over';document.exitPointerLock();show(win?'win':'over');if(win){tone(440,1.5,'triangle',.2,880)}else growl()}
$('play').onclick=start;document.querySelectorAll('.re').forEach(b=>b.onclick=start);
$('resume').onclick=()=>{state='play';show(null);canvas.requestPointerLock()};
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas&&state==='play')pause()});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&state==='play'){yaw-=e.movementX*.0022;pitch=Math.max(-1.4,Math.min(1.4,pitch-e.movementY*.0022))}});
addEventListener('keydown',e=>{K[e.code]=true;if(e.code==='KeyM')setMute(!muted);if(state!=='play')return;
 if(e.code==='KeyF'&&bat>0){flashOn=!flashOn;tone(1200,.04,'square',.1)}if(e.code==='KeyE')interact()});
addEventListener('keyup',e=>K[e.code]=false);
addEventListener('blur',()=>{for(const k in K)K[k]=false});
function say(t){msg=t;msgT=2.2}
function interact(){if(!cur)return;
 if(cur.item){const i=cur.item;if(i.t==='K'){keys++;say('Key collected')}else if(i.t==='R'){rel++;say('Relic collected ('+rel+'/3)')}else{bat=Math.min(100,bat+40);say('Battery recharged')}
  dyn.remove(i.m);items=items.filter(o=>o!==i);pickS()}
 else{const d=cur.door;if(d.ch==='X'){if(rel>=3)end(true);else{say('The exit is sealed. Relics: '+rel+'/3');tone(80,.3,'square',.15)}}
  else if(keys>0){keys--;closed.delete(d.x+','+d.z);dyn.remove(d.m);say('Door unlocked');tone(150,.8,'sawtooth',.2,70)}else{say('Locked. Find a key.');tone(80,.2,'square',.15)}}}

// ---------- Update loop
function update(dt,t){
 let f=(K.KeyW?1:0)-(K.KeyS?1:0),s=(K.KeyD?1:0)-(K.KeyA?1:0);const run=(K.ShiftLeft||K.ShiftRight)&&f>0&&true;
 if(f||s){const l=Math.hypot(f,s),sp=run?5.8:3.4,sn=Math.sin(yaw),cs=Math.cos(yaw);f/=l;s/=l;
  tryMove((-sn*f+cs*s)*sp*dt,(-cs*f-sn*s)*sp*dt);walk+=dt*(run?11:7);stepAcc+=dt*(run?3.2:2.1);if(stepAcc>1){stepAcc=0;hiss(.09,.25,350)}}
 cam.rotation.set(pitch,yaw,0,'YXZ');cam.position.set(P.x,1.65+(f||s?Math.sin(walk)*.045:0),P.z);
 if(flashOn&&bat>0){bat=Math.max(0,bat-dt*1.1);if(bat<=0){flashOn=false}}
 spot.intensity=flashOn?(bat<20&&Math.random()<.12?.6:2.6):0;
 lamps.forEach((l,i)=>l.intensity=.45+Math.sin(t*(3+i)+i*7)*.12*(Math.random()<.05?3:1));
 const d=updMonster(dt,run&&(f||s),t);
 if(d<12&&M.mode==='chase'){beat-=dt;if(beat<=0){beat=.25+d*.07;tone(55,.18,'sine',.5,35)}}
 items.forEach(i=>{i.m.rotation.y=t*1.5;i.m.position.y=1+Math.sin(t*2+i.x)*.08});
 // interaction target
 cur=null;let best=9;const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
 const tryT=(x,z,lim,o)=>{const dx=x-P.x,dz=z-P.z,dd=Math.hypot(dx,dz);if(dd<lim&&(dx*fx+dz*fz)/(dd||1)>.35&&dd<best){best=dd;cur=o}};
 items.forEach(i=>tryT(i.x,i.z,2.2,{item:i}));doors.forEach(d=>{if(closed.has(d.x+','+d.z))tryT(ctr(d.x),ctr(d.z),3,{door:d})});
 msgT-=dt;
 $('prompt').textContent=msgT>0?msg:cur?(cur.item?'E – pick up '+({K:'key',R:'relic',b:'battery'}[cur.item.t]):cur.door.ch==='X'?'E – open exit door':'E – unlock door (uses 1 key)'):'';
 $('hp').style.width=Math.max(0,hp)+'%';$('bat').style.width=bat+'%';$('keys').textContent=keys;$('rel').textContent=rel;
 $('obj').textContent=rel<3?'Find the 3 relics. Keys open locked doors.':'Reach the exit door at the east end of the corridor.';
 dmgF=Math.max(0,dmgF-dt*1.5);$('flash').style.opacity=dmgF*.6;
 if(hp<=0)end(false)}
const clock=new THREE.Clock();
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);if(state==='play')update(dt,clock.elapsedTime);ren.render(scene,cam)}
reset();loop();
