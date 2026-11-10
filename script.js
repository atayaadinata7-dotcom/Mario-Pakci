(()=>{
'use strict';

/* =====================================================================
   MARIO PAKCI : KERAJAAN YANG HILANG
   ===================================================================== */

const $=id=>document.getElementById(id);
const W=800,H=450,GROUND=365,STEP=1/60;
const gcv=$('game'),gctx=gcv.getContext('2d');
const mcv=$('menuBg'),mctx=mcv.getContext('2d');
gctx.imageSmoothingEnabled=false;
mctx.imageSmoothingEnabled=false;
let g=gctx; // konteks gambar yang sedang aktif
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------------- Penyimpanan (aman bila localStorage diblokir) ---------------- */
const KEY_PLAYER='mariopakci.player.v2',KEY_BOARD='mariopakci.board.v2',KEY_MUTE='mariopakci.mute.v2';
const mem={};
const store={
  get(k){try{return localStorage.getItem(k)}catch(e){return mem[k]??null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){mem[k]=v}}
};

/* ---------------- Data dunia ---------------- */
const WORLDS=[
  {name:'PADANG ZAMRUD',icon:'🌿',desc:'Padang hijau yang tenang, tapi penuh makhluk iseng.'},
  {name:'GUA KRISTAL',icon:'💎',desc:'Gua gelap berkilau. Awas kelelawar dan hantu!'},
  {name:'KERAJAAN LANGIT',icon:'☁️',desc:'Istana di atas awan dijaga para ksatria.'}
];
const THEMES=[
  {sky1:'#67d8f2',sky2:'#d2fff0',far:'#8bc9a7',near:'#438f77',ground:'#87533b',top:'#64d96e',accent:'#ffdf65',plat:'#55467f',stars:false},
  {sky1:'#171d49',sky2:'#594a92',far:'#555c9a',near:'#343a6d',ground:'#51466f',top:'#6ce6f5',accent:'#c5a6ff',plat:'#62558e',stars:true},
  {sky1:'#ee9ab8',sky2:'#ffe9ac',far:'#c2a4e9',near:'#8b78c6',ground:'#7660a0',top:'#ffda83',accent:'#fff3a1',plat:'#55467f',stars:true}
];
const MENU_THEME={sky1:'#2a2f7a',sky2:'#ff9fb8',far:'#5b5fb0',near:'#3c4085',ground:'#2f2a5c',top:'#6ce6f5',accent:'#ffe77a',plat:'#55467f',stars:true};
const SETS=[
  {ground:['slime','beetle','hopper'],fly:['bird'],flyP:.25},
  {ground:['crystal','beetle'],fly:['bat','ghost'],flyP:.6},
  {ground:['knight','beetle'],fly:['cloud','bird'],flyP:.7}
];
const ENEMY_SIZE={slime:[28,27],beetle:[28,27],hopper:[28,27],crystal:[28,30],knight:[31,34],bat:[28,22],ghost:[28,27],bird:[28,22],cloud:[28,25]};

/* ---------------- State ---------------- */
let screen='register',mode='register';
let world=0,score=0,coinCount=0,lives=3;
let camera=0,clock=0,shake=0,levelLength=4000,checkpointX=60,goalX=0,acc=0,lastT=performance.now();
let platforms=[],coins=[],enemies=[],hazards=[],orbs=[],hearts=[],checkpoints=[],particles=[];
let snap={score:0,coins:0,lives:3};
let endKind='over',lastShieldSec=-1;
const keys={left:false,right:false};
let jumpHeld=false,jumpBuf=0;
let me=null,board=[],muted=false;

const player={x:60,y:GROUND-39,w:28,h:39,vx:0,vy:0,ground:false,face:1,inv:0,jumps:0,shield:0,coyote:0,cut:false,prevY:0};

/* ---------------- Audio ---------------- */
let actx=null;
function ensureAudio(){
  try{
    if(!actx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)actx=new AC()}
    if(actx&&actx.state==='suspended')actx.resume();
  }catch(e){}
}
function tone(f,d=.08,type='square',vol=.04,slide=null,delay=0){
  if(muted||!actx)return;
  try{
    const t0=actx.currentTime+delay,o=actx.createOscillator(),gn=actx.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t0);
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,t0+d);
    gn.gain.setValueAtTime(vol,t0);
    gn.gain.exponentialRampToValueAtTime(.0008,t0+d);
    o.connect(gn);gn.connect(actx.destination);
    o.start(t0);o.stop(t0+d+.03);
  }catch(e){}
}
const sfx={
  click:()=>tone(700,.05,'square',.03),
  jump:()=>tone(330,.14,'square',.04,660),
  djump:()=>tone(520,.16,'triangle',.05,1100),
  coin:()=>{tone(988,.06,'square',.035);tone(1319,.12,'square',.035,null,.06)},
  stomp:()=>tone(230,.12,'square',.05,90),
  hurt:()=>tone(200,.3,'sawtooth',.05,60),
  power:()=>[523,659,784,1046].forEach((f,i)=>tone(f,.1,'triangle',.05,null,i*.07)),
  heart:()=>[660,880,1320].forEach((f,i)=>tone(f,.1,'triangle',.05,null,i*.07)),
  check:()=>{tone(660,.1,'triangle',.05);tone(880,.18,'triangle',.05,null,.09)},
  win:()=>[523,659,784,659,784,1046].forEach((f,i)=>tone(f,.14,'square',.04,null,i*.11)),
  over:()=>[392,330,262,196].forEach((f,i)=>tone(f,.22,'triangle',.05,null,i*.2))
};
// Musik latar sederhana
const SCALES=[[0,2,4,7,9],[0,3,5,7,10],[0,2,5,7,9]],ROOTS=[262,220,294],PATTERN=[0,2,1,3,2,4,3,1];
let mStep=0;
setInterval(()=>{
  if(mode!=='play'||muted||!actx)return;
  const sc=SCALES[world],r=ROOTS[world];
  if(mStep%2===0)tone(r*Math.pow(2,sc[PATTERN[mStep%8]]/12),.2,'triangle',.018);
  if(mStep%4===0)tone(r/2,.35,'sine',.03);
  mStep++;
},210);

function setMuted(m){
  muted=m;store.set(KEY_MUTE,m?'1':'0');
  $('muteBtn').textContent=m?'🔇':'🔊';
  $('menuMute').textContent=m?'🔇 SUARA: MATI':'🔊 SUARA: NYALA';
}

/* ---------------- Acak berbenih ---------------- */
function mulberry32(a){
  return function(){
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}

/* =====================================================================
   PAPAN PERINGKAT & PEMAIN
   ===================================================================== */
function loadBoard(){
  try{
    const a=JSON.parse(store.get(KEY_BOARD)||'[]');
    if(!Array.isArray(a))return[];
    return a.filter(e=>e&&typeof e.name==='string'&&typeof e.score==='number');
  }catch(e){return[]}
}
function saveBoard(){store.set(KEY_BOARD,JSON.stringify(board.slice(0,50)))}
const keyOf=p=>(p.name+'|'+p.school).toLowerCase();
const myKey=()=>me?keyOf(me):'';

function submitScore(){
  if(!me||score<=0)return;
  const k=myKey();
  const i=board.findIndex(e=>e.key===k);
  if(i>=0){
    if(score>board[i].score){board[i].score=score;board[i].coins=coinCount}
    board[i].age=me.age;
  }else{
    board.push({key:k,name:me.name,age:me.age,school:me.school,score,coins:coinCount});
  }
  board.sort((a,b)=>b.score-a.score);
  saveBoard();
}
function rankFor(s){
  const k=myKey();
  return 1+board.filter(e=>e.key!==k&&e.score>s).length;
}
function myBest(){
  const e=board.find(x=>x.key===myKey());
  return e?e.score:0;
}
function el(tag,cls,text){
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=text;
  return n;
}
function renderBoard(){
  const list=$('boardList');
  list.textContent='';
  const top=board.slice(0,10);
  $('boardEmpty').classList.toggle('hidden',top.length>0);
  top.forEach((e,i)=>{
    const li=el('li','row'+(e.key===myKey()?' me':'')+(i<3?' top'+(i+1):''));
    li.appendChild(el('span','rk',i<3?['🥇','🥈','🥉'][i]:String(i+1)));
    const nm=el('span','nm');
    nm.appendChild(el('b','',e.name));
    nm.appendChild(el('small','',e.school+' · '+e.age+' th'));
    li.appendChild(nm);
    li.appendChild(el('span','sc',e.score.toLocaleString('id-ID')));
    list.appendChild(li);
  });
  const idx=board.findIndex(e=>e.key===myKey());
  const box=$('boardMe');
  if(idx<0)box.textContent='Kamu belum punya skor. Ayo main sekarang!';
  else if(idx<3)box.textContent='Hebat! Kamu ada di peringkat #'+(idx+1)+' 🎉';
  else box.textContent='Peringkatmu: #'+(idx+1)+' dari '+board.length+' pemain';
}
function renderMenu(){
  if(!me)return;
  $('menuAvatar').textContent=me.name.trim().charAt(0).toUpperCase()||'?';
  $('menuPlayerName').textContent=me.name;
  $('menuPlayerInfo').textContent=me.school+' · '+me.age+' tahun';
  $('menuBest').textContent=myBest().toLocaleString('id-ID');
  $('gamePlayer').textContent='PEMAIN: '+me.name+' · '+me.school;
  renderBoard();
}

/* =====================================================================
   LAYAR & REGISTRASI
   ===================================================================== */
const SCREEN_IDS={register:'screenRegister',menu:'screenMenu',game:'screenGame'};
function setScreen(name){
  screen=name;
  for(const k in SCREEN_IDS)$(SCREEN_IDS[k]).classList.toggle('active',k===name);
  document.body.classList.toggle('playing',name==='game');
  window.scrollTo(0,0);
}
function closeModals(){$('worldModal').classList.add('hidden');$('howModal').classList.add('hidden')}

function fieldError(inputId,errId,msg){
  const f=$(inputId).closest('.field');
  f.classList.toggle('invalid',!!msg);
  $(errId).textContent=msg||'';
  if(msg){f.classList.remove('invalid');void f.offsetWidth;f.classList.add('invalid')}
  return !msg;
}
function submitRegistration(e){
  e.preventDefault();
  const name=$('inName').value.trim().replace(/\s+/g,' ');
  const ageRaw=$('inAge').value.trim();
  const age=parseInt(ageRaw,10);
  const school=$('inSchool').value.trim().replace(/\s+/g,' ');
  let ok=true;
  ok=fieldError('inName','errName',name.length<2?'Nama minimal 2 karakter.':'')&&ok;
  ok=fieldError('inAge','errAge',(!/^\d+$/.test(ageRaw)||age<5||age>99)?'Masukkan umur antara 5 – 99 tahun.':'')&&ok;
  ok=fieldError('inSchool','errSchool',school.length<2?'Tuliskan asal sekolahmu.':'')&&ok;
  if(!ok)return;
  me={name,age,school};
  store.set(KEY_PLAYER,JSON.stringify(me));
  ensureAudio();sfx.click();
  renderMenu();
  mode='menu';
  setScreen('menu');
}

/* =====================================================================
   MEMBANGUN LEVEL (acak, platform sedikit & renggang)
   ===================================================================== */
function buildWorld(n){
  world=n;
  const rand=mulberry32((Date.now()+n*7919)>>>0);
  const R=(a,b)=>a+rand()*(b-a);
  const pick=a=>a[Math.floor(rand()*a.length)];
  platforms=[];coins=[];enemies=[];hazards=[];orbs=[];hearts=[];checkpoints=[];particles=[];
  const set=SETS[n];

  // 1) Potongan tanah dan jurang (jurang bisa dilewati dengan lompat biasa)
  const target=3800+n*600;
  const segs=[{x:0,w:560}];
  let x=560;
  while(x<target){
    const gap=R(85,105+n*20),w=R(340,560);
    segs.push({x:x+gap,w});
    x+=gap+w;
  }
  segs.push({x:x+R(85,105+n*20),w:660});
  const lastSeg=segs[segs.length-1];
  levelLength=lastSeg.x+lastSeg.w;
  goalX=levelLength-190;
  segs.forEach(s=>platforms.push({x:s.x,y:GROUND,w:s.w,h:110,type:'ground'}));

  // 2) Koin melengkung di atas jurang sebagai penuntun lompatan
  for(let i=0;i<segs.length-1;i++){
    const gs=segs[i].x+segs[i].w,ge=segs[i+1].x;
    for(let k=0;k<5;k++){
      coins.push({x:gs-25+(ge-gs+50)*k/4,y:GROUND-34-Math.sin(Math.PI*k/4)*70,got:false});
    }
  }

  // 3) Duri, musuh, koin tanah (tidak di potongan pertama & terakhir)
  for(let i=1;i<segs.length-1;i++){
    const s=segs[i];
    const spikeXs=[];
    if(rand()<.5+n*.12){
      const w=rand()<.5?30:40,sx=R(s.x+130,s.x+s.w-130-w);
      hazards.push({x:sx,y:GROUND-8,w,h:8});spikeXs.push(sx);
    }
    if(n>0&&rand()<.3){
      const w=30,sx=R(s.x+130,s.x+s.w-130-w);
      if(spikeXs.every(a=>Math.abs(a-sx)>150))hazards.push({x:sx,y:GROUND-8,w,h:8});
    }
    // musuh darat
    if(rand()<.85){
      const type=pick(set.ground),[ew,eh]=ENEMY_SIZE[type];
      const mn=s.x+35,mx=s.x+s.w-35-ew;
      enemies.push({type,fly:false,x:R(mn,mx),y:GROUND-eh,baseY:GROUND-eh,w:ew,h:eh,
        vx:(rand()<.5?-1:1)*(.55+n*.12+rand()*.2),min:mn,max:mx,phase:rand()*6,amp:0,alive:true});
    }
    // musuh terbang
    if(rand()<set.flyP){
      const type=pick(set.fly),[ew,eh]=ENEMY_SIZE[type];
      const cx=s.x+R(100,s.w-100);
      enemies.push({type,fly:true,x:cx,y:210,baseY:R(205,262),w:ew,h:eh,
        vx:(rand()<.5?-1:1)*(.7+n*.1),min:cx-80,max:cx+80,phase:rand()*6,amp:22,alive:true});
    }
    // koin tanah
    if(rand()<.6){
      const cx=R(s.x+60,s.x+s.w-200);
      if(!hazards.some(h=>h.x>cx-40&&h.x<cx+150)){
        for(let k=0;k<4;k++)coins.push({x:cx+k*30,y:GROUND-28,got:false});
      }
    }
  }

  // 4) Tanah melayang: sedikit, acak, berjarak jauh
  const floats=[];
  let px=R(650,800);
  while(px<goalX-500){
    const w=R(90,140),y=R(235,300);
    const f={x:px,y,w,h:16,type:'float'};
    platforms.push(f);floats.push(f);
    for(let j=0;j<3;j++)coins.push({x:px+w/2-19+j*19,y:y-24,got:false});
    px+=w+R(260,430);
  }

  // 5) Orb perisai & hati di atas tanah melayang
  const spot=(arr,frac)=>arr.length?arr[Math.min(arr.length-1,Math.floor(arr.length*frac))]:null;
  const o=spot(floats,.4),h=spot(floats,.75);
  if(o)orbs.push({x:o.x+o.w/2,y:o.y-36,got:false});
  else orbs.push({x:segs[2].x+segs[2].w/2,y:GROUND-60,got:false});
  if(h&&h!==o)hearts.push({x:h.x+h.w/2,y:h.y-36,got:false});

  // 6) Checkpoint
  const ci=[Math.round((segs.length-1)*.33),Math.round((segs.length-1)*.66)];
  [...new Set(ci)].filter(i=>i>=1&&i<segs.length-1).forEach(i=>checkpoints.push({x:segs[i].x+70,active:false}));

  // 7) Pemain
  checkpointX=60;
  Object.assign(player,{x:60,y:GROUND-player.h,vx:0,vy:0,ground:true,face:1,inv:1.2,jumps:0,shield:0,coyote:0,cut:false});
  camera=0;jumpBuf=0;lastShieldSec=-1;
  updateHUD();
}

/* =====================================================================
   HUD, TOAST, ALUR PERMAINAN
   ===================================================================== */
function updateHUD(){
  $('hudWorld').textContent=WORLDS[world].icon+' '+WORLDS[world].name;
  $('hudLives').textContent=lives>0?'♥'.repeat(lives):'☠';
  $('hudCoins').textContent='🪙 '+coinCount;
  $('hudScore').textContent='SKOR '+String(score).padStart(5,'0');
  $('hudRank').textContent='🏆 #'+rankFor(score);
  const sh=player.shield>0;
  $('hudPower').classList.toggle('hidden',!sh);
  if(sh)$('hudPower').textContent='🛡 '+Math.ceil(player.shield)+' dtk';
}
let toastTimer=0;
function toast(msg){
  const t=$('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),1600);
}
function releaseKeys(){keys.left=keys.right=false;jumpHeld=false;jumpBuf=0}

function startGame(n,reset){
  ensureAudio();
  if(reset){score=0;coinCount=0;lives=3}
  snap={score,coins:coinCount,lives};
  buildWorld(n);
  releaseKeys();
  $('pauseMenu').classList.add('hidden');
  $('endMenu').classList.add('hidden');
  closeModals();
  setScreen('game');
  mode='play';acc=0;lastT=performance.now();
  toast('DUNIA '+(n+1)+' · '+WORLDS[n].name);
}
function retryWorld(){
  score=snap.score;coinCount=snap.coins;lives=Math.max(3,snap.lives);
  startGame(world,false);
}
function backToMenu(){
  submitScore();
  releaseKeys();
  mode='menu';
  $('pauseMenu').classList.add('hidden');
  $('endMenu').classList.add('hidden');
  renderMenu();
  setScreen('menu');
}
function pauseGame(){
  if(mode==='play'){
    mode='pause';releaseKeys();
    $('pauseMenu').classList.remove('hidden');
  }else if(mode==='pause'){
    mode='play';lastT=performance.now();acc=0;
    $('pauseMenu').classList.add('hidden');
  }
}
function showEnd(kind,title,text){
  endKind=kind;mode='end';releaseKeys();
  submitScore();
  const idx=board.findIndex(e=>e.key===myKey());
  $('endTitle').textContent=title;
  $('endText').textContent=text;
  $('endRank').textContent=idx>=0?'🏆 Peringkatmu: #'+(idx+1)+' dari '+board.length+' pemain':'🏆 Raih poin untuk masuk peringkat!';
  $('endPrimary').textContent={clear:'▶ DUNIA BERIKUTNYA',win:'↻ MAIN LAGI',over:'↻ COBA LAGI'}[kind];
  $('endRetry').classList.toggle('hidden',kind!=='clear');
  $('endMenu').classList.remove('hidden');
}
function gameOver(){
  sfx.over();
  showEnd('over','GAME OVER','Skor: '+score+' · Koin: '+coinCount);
}
function completeWorld(){
  score+=250+lives*50;
  updateHUD();
  sfx.win();
  if(world<2)showEnd('clear','DUNIA SELESAI!',WORLDS[world].name+' berhasil ditaklukkan! Bonus +'+(250+lives*50)+' poin. Skor: '+score);
  else showEnd('win','KERAJAAN PULIH!','Kamu menaklukkan ketiga dunia! Skor akhir: '+score+' · Koin: '+coinCount);
}
function respawn(){
  Object.assign(player,{x:checkpointX,y:GROUND-player.h,vx:0,vy:0,inv:2,jumps:0,cut:false,ground:true});
  camera=clamp(player.x-260,0,levelLength-W);
}
function fall(){
  lives--;shake=10;sfx.hurt();
  updateHUD();
  if(lives<=0){gameOver();return}
  respawn();
  toast('JATUH! Kembali ke checkpoint');
}
function hurt(){
  const p=player;
  if(p.inv>0||p.shield>0)return;
  lives--;shake=10;sfx.hurt();
  burst(p.x+14,p.y+15,'#ff6b91',14);
  updateHUD();
  if(lives<=0){gameOver();return}
  p.inv=1.8;p.vy=-6.5;p.vx=-p.face*3.5;
}
function burst(x,y,color,n=10){
  for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*5,vy:-Math.random()*5-1,life:22+Math.random()*20,color,size:2+Math.random()*4});
}

/* =====================================================================
   LOGIKA PERMAINAN (langkah tetap 60 fps)
   ===================================================================== */
function step(){
  const p=player;
  clock+=1000/60;
  if(p.inv>0)p.inv=Math.max(0,p.inv-1/60);
  if(p.shield>0){
    p.shield=Math.max(0,p.shield-1/60);
    const sec=Math.ceil(p.shield);
    if(sec!==lastShieldSec){lastShieldSec=sec;updateHUD()}
  }

  // tanah / coyote time
  if(p.ground){p.coyote=7;p.jumps=0}
  else{p.coyote=Math.max(0,p.coyote-1);if(p.coyote===0&&p.jumps===0)p.jumps=1}
  if(jumpBuf>0)jumpBuf--;

  // gerak horizontal
  const dir=(keys.right?1:0)-(keys.left?1:0);
  if(dir){p.vx+=dir*.6;p.face=dir}else p.vx*=.8;
  if(Math.abs(p.vx)<.05)p.vx=0;
  p.vx=clamp(p.vx,-4.1,4.1);

  // lompat + LOMPAT GANDA
  if(jumpBuf>0){
    if(p.coyote>0){
      p.vy=-9.1;p.ground=false;p.coyote=0;p.jumps=1;p.cut=false;jumpBuf=0;
      sfx.jump();burst(p.x+14,p.y+p.h,'#ffffff',4);
    }else if(p.jumps<2){
      p.vy=-8.4;p.jumps=2;p.cut=false;jumpBuf=0;
      sfx.djump();burst(p.x+14,p.y+p.h,'#9df8ff',10);
    }
  }
  // lompat variabel: lepas tombol = lompatan lebih pendek
  if(!jumpHeld&&p.vy<-3.5&&!p.cut){p.vy*=.5;p.cut=true}

  // fisika horizontal (tabrakan dinding tanah)
  p.x+=p.vx;
  for(const pl of platforms){
    if(pl.type!=='ground')continue;
    if(p.x+p.w>pl.x&&p.x<pl.x+pl.w&&p.y+p.h>pl.y+6&&p.y<pl.y+pl.h){
      if(p.vx>0)p.x=pl.x-p.w;else if(p.vx<0)p.x=pl.x+pl.w;
      p.vx=0;
    }
  }
  p.x=clamp(p.x,0,levelLength-p.w);

  // fisika vertikal (mendarat dari atas; tanah melayang bisa ditembus dari bawah)
  p.prevY=p.y;
  p.vy=Math.min(10.5,p.vy+.42);
  p.y+=p.vy;
  p.ground=false;
  for(const pl of platforms){
    if(p.vy>=0&&p.x+p.w>pl.x&&p.x<pl.x+pl.w&&p.prevY+p.h<=pl.y+1&&p.y+p.h>=pl.y){
      p.y=pl.y-p.h;p.vy=0;p.ground=true;
    }
  }

  // koin
  for(const c of coins){
    if(!c.got&&Math.abs(p.x+14-c.x)<20&&Math.abs(p.y+19-c.y)<26){
      c.got=true;coinCount++;score+=10;
      sfx.coin();burst(c.x,c.y,'#ffe66d',6);updateHUD();
    }
  }
  // orb perisai
  for(const o of orbs){
    if(!o.got&&Math.abs(p.x+14-o.x)<26&&Math.abs(p.y+19-o.y)<30){
      o.got=true;p.shield=10;score+=50;
      sfx.power();burst(o.x,o.y,'#8ff7ff',18);toast('PERISAI AKTIF! 10 detik kebal');updateHUD();
    }
  }
  // hati
  for(const h of hearts){
    if(!h.got&&Math.abs(p.x+14-h.x)<24&&Math.abs(p.y+19-h.y)<28){
      h.got=true;score+=25;
      if(lives<5){lives++;toast('+1 NYAWA!')}else toast('+25 POIN');
      sfx.heart();burst(h.x,h.y,'#ff7aa0',14);updateHUD();
    }
  }

  // musuh
  for(const e of enemies){
    if(!e.alive)continue;
    e.x+=e.vx;
    if(e.x<e.min){e.x=e.min;e.vx=Math.abs(e.vx)}
    if(e.x>e.max){e.x=e.max;e.vx=-Math.abs(e.vx)}
    if(e.fly)e.y=e.baseY+Math.sin(clock*.003+e.phase)*e.amp;
    else if(e.type==='hopper')e.y=e.baseY-Math.max(0,Math.sin(clock*.0045+e.phase))*42;

    if(p.x+p.w-3>e.x+2&&p.x+3<e.x+e.w-2&&p.y+p.h>e.y+2&&p.y<e.y+e.h){
      const stomp=p.vy>0.3&&(p.y+p.h)-e.y<22;
      if(stomp||p.shield>0){
        e.alive=false;score+=100;
        if(stomp){p.vy=jumpHeld?-9:-6.5;p.jumps=1;p.cut=false}
        sfx.stomp();burst(e.x+14,e.y+12,'#ff9aaf',12);updateHUD();
      }else hurt();
      if(mode!=='play')return;
    }
  }

  // duri
  if(p.shield<=0){
    for(const h of hazards){
      if(p.x+p.w-4>h.x&&p.x+4<h.x+h.w&&p.y+p.h>h.y+2&&p.y<h.y+h.h){hurt();if(mode!=='play')return}
    }
  }

  // checkpoint
  for(const c of checkpoints){
    if(!c.active&&p.x>c.x){
      c.active=true;checkpointX=c.x;
      sfx.check();burst(c.x+10,300,'#8bffc4',12);toast('CHECKPOINT!');
    }
  }

  // partikel
  for(const a of particles){a.x+=a.vx;a.y+=a.vy;a.vy+=.16;a.life--}
  particles=particles.filter(a=>a.life>0);

  // kamera
  camera+=(clamp(p.x-260,0,levelLength-W)-camera)*.14;
  $('progressFill').style.width=clamp(p.x/goalX*100,0,100)+'%';

  if(p.y>H+80){fall();return}
  if(p.x+p.w/2>goalX+24)completeWorld();
}

/* =====================================================================
   GAMBAR : sprite & pemandangan
   ===================================================================== */
function box(x,y,w,h,col){g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}

function drawScene(t,cam,time,sw=W,sh=H,gy=GROUND){
  const gr=g.createLinearGradient(0,0,0,sh);
  gr.addColorStop(0,t.sky1);gr.addColorStop(1,t.sky2);
  g.fillStyle=gr;g.fillRect(0,0,sw,sh);

  if(t.stars){
    const n=Math.round(sw/14.5),sr=Math.max(120,gy-65);
    for(let i=0;i<n;i++){
      const sx=(((i*139-cam*.05)%sw)+sw)%sw,sy=(i*67)%sr;
      box(sx,sy,2,2,Math.sin(time*.002+i)>.2?'#ffffffcc':'#ffffff66');
    }
  }
  // matahari / bulan
  const sx0=sw-125;
  box(sx0,50,44,44,t.accent);box(sx0-9,61,62,22,t.accent);box(sx0+10,39,24,66,t.accent);

  // gunung berlapis (tidak "meloncat" saat bergulir)
  for(let layer=0;layer<2;layer++){
    g.fillStyle=layer?t.near:t.far;
    const off=cam*(.12+layer*.12),sp=125,first=Math.floor(off/sp)-1,cnt=Math.ceil(sw/sp)+3;
    for(let i=first;i<first+cnt;i++){
      const bx=i*sp-off,by=layer?gy-55:gy-80,hh=(((i*7+layer*3)%3)+3)%3;
      g.beginPath();g.moveTo(bx,gy+65);g.lineTo(bx+65,by-hh*23);g.lineTo(bx+140,gy+65);g.closePath();g.fill();
    }
  }
  // awan piksel
  const nc=Math.round(sw/100),wr=sw+100;
  for(let i=0;i<nc;i++){
    const x=((((i*143-cam*.18-time*.008*(1+(i%3)*.4))%wr)+wr)%wr)-40,y=55+(i%3)*50;
    box(x,y,48,12,'#ffffffa8');box(x+10,y-10,25,14,'#ffffffa8');box(x+29,y-4,23,10,'#ffffffa8');
  }
}
function drawCoinAt(x,y,time,ph){
  const w=4+Math.abs(Math.sin(time*.008+ph))*5;
  box(x-w/2,y-9,w,18,'#f4a51d');
  box(x-w/2+2,y-6,Math.max(2,w-4),12,'#ffe66d');
  box(x-1,y-5,2,10,'#fff6a8');
}
function drawEnemySprite(e,x,y,time){
  const bob=Math.sin(time*.012+e.phase)*2,t=e.type;
  if(t==='bat'||t==='bird'){
    const flap=Math.sin(time*.02+e.phase)*3;
    box(x+5,y+8+bob,20,13,t==='bat'?'#6d5de7':'#ed6c7c');
    box(x,y+5+bob+flap,10,9,'#3f3e93');
    box(x+18,y+4+bob-flap,10,10,'#3f3e93');
    box(x+9,y+11+bob,4,4,'#fff');box(x+18,y+11+bob,4,4,'#fff');
  }else if(t==='crystal'){
    box(x+7,y+2,15,25,'#78f4ff');box(x+3,y+10,23,12,'#4aaddb');
    box(x+12,y+5,5,15,'#d5ffff');box(x+10,y+26,9,4,'#bba9ff');
  }else if(t==='ghost'){
    box(x+5,y+2+bob,20,20,'#d6e2ff');box(x+2,y+10+bob,26,13,'#abb9ed');
    box(x+9,y+9+bob,4,6,'#202447');box(x+19,y+9+bob,4,6,'#202447');
    box(x+6,y+22+bob,5,5,'#d6e2ff');box(x+17,y+22+bob,5,5,'#d6e2ff');
  }else if(t==='cloud'){
    box(x+4,y+7+bob,21,14,'#fff0c9');box(x,y+12+bob,28,11,'#d4f5ff');box(x+9,y+2+bob,12,12,'#fff');
    box(x+8,y+12+bob,3,4,'#26305a');box(x+19,y+12+bob,3,4,'#26305a');
  }else if(t==='knight'){
    box(x+4,y+4,22,15,'#929bc7');box(x+2,y+9,26,8,'#5c6a9b');
    box(x+7,y+8,5,4,'#ffe66d');box(x+18,y+8,5,4,'#ffe66d');
    box(x+5,y+19,7,13,'#e4a95b');box(x+19,y+19,7,13,'#e4a95b');box(x+10,y+2,10,4,'#d7e6ff');
  }else{
    const col=t==='slime'?'#55d68b':t==='beetle'?'#e55e78':'#f3a5ff';
    box(x+3,y+8+bob,22,15,col);box(x+7,y+3+bob,14,9,col);
    box(x+8,y+10+bob,4,5,'#fff');box(x+17,y+10+bob,4,5,'#fff');
    box(x+9,y+11+bob,2,3,'#202447');box(x+18,y+11+bob,2,3,'#202447');
    box(x+5,y+23+bob,6,4,'#34375e');box(x+19,y+23+bob,6,4,'#34375e');
  }
}
function drawHero(x,y,face,run,time,shield){
  box(x-2,y+39,32,4,'#171b3b35');
  const leg=run?Math.sin(time*.025)*4:0;
  box(x+4,y+26,8,9+leg,'#283d86');box(x+17,y+26,8,9-leg,'#283d86');
  box(x+2,y+34+leg,12,5,'#f7dfb0');box(x+16,y+34-leg,12,5,'#f7dfb0');
  box(x+4,y+13,21,16,'#f5ae3f');box(x+1,y+15,5,10,'#f5ae3f');box(x+23,y+15,5,9,'#f5ae3f');
  box(x+4,y+20,21,8,'#3769da');box(x+9,y+22,5,5,'#ffe66d');
  box(x+5,y+2,19,15,'#ffd0a0');box(x+3,y,23,7,'#d94f75');box(x+1,y+4,26,5,'#ef6684');box(x+8,y-4,13,5,'#ffe66d');
  const ex=face>0?18:7;
  box(x+ex,y+6,4,5,'#242343');box(x+ex+(face>0?1:-1),y+7,1,2,'#fff');
  if(shield){
    const r=30+Math.sin(time*.012)*2;
    g.fillStyle='#9df8ff22';g.strokeStyle='#9df8ffcc';g.lineWidth=3;
    g.beginPath();g.arc(x+14,y+20,r,0,Math.PI*2);g.fill();g.stroke();
  }
}
function drawHeart(x,y,time){
  const b=Math.sin(time*.006)*3;y+=b;
  box(x-10,y-6,8,7,'#ff5a85');box(x+2,y-6,8,7,'#ff5a85');
  box(x-12,y-3,24,7,'#ff5a85');box(x-9,y+4,18,4,'#ff5a85');box(x-5,y+8,10,3,'#ff5a85');box(x-2,y+11,4,2,'#ff5a85');
  box(x-8,y-4,3,3,'#ffd0dc');
}
function drawOrb(x,y,time){
  const b=Math.sin(time*.006)*3;y+=b;
  box(x-11,y-11,22,22,'#a5fbff');box(x-6,y-16,12,32,'#71d8ff');box(x-16,y-6,32,12,'#71d8ff');box(x-4,y-4,8,8,'#fff');
  if(Math.floor(time/200)%2===0){box(x-20,y-1,3,3,'#fff');box(x+17,y-1,3,3,'#fff')}
}
function drawGroundStrip(t,cam,sw=W,sh=H,gy=GROUND){
  box(0,gy,sw,sh-gy,t.ground);box(0,gy,sw,12,t.top);
  const off=((cam%30)+30)%30;
  for(let a=-1;a<sw/30+2;a++){const x=a*30-off;box(x,gy+22,13,4,'#ffffff17');box(x+12,gy+36,8,4,'#00000022')}
}

/* ---- Gambar dunia permainan ---- */
function drawPlatform(p,t){
  const x=p.x-camera;
  if(x+p.w<0||x>W)return;
  if(p.type==='ground'){
    box(x,p.y,p.w,p.h,t.ground);box(x,p.y,p.w,12,t.top);
    for(let a=0;a<p.w;a+=30){box(x+a,p.y+25,13,4,'#ffffff17');box(x+a+12,p.y+57,8,4,'#00000022')}
    box(x,p.y+12,4,p.h,'#0003');box(x+p.w-4,p.y+12,4,p.h,'#0003');
  }else{
    box(x,p.y,p.w,p.h,t.plat);box(x,p.y,p.w,6,t.accent);box(x+6,p.y+8,p.w-12,3,'#ffffff55');
  }
}
function drawGame(){
  g=gctx;
  const t=THEMES[world];
  g.save();
  if(shake>0&&mode==='play'){g.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-1)}
  drawScene(t,camera,clock);
  box(0,GROUND+6,W,H,'#0a0d2a66'); // jurang tampak gelap
  for(const p of platforms)drawPlatform(p,t);

  // duri
  for(const h of hazards){
    const x=h.x-camera;
    if(x<-50||x>W+50)continue;
    g.fillStyle=world===1?'#b8eaff':'#e7eaff';
    for(let i=0;i<h.w;i+=10){g.beginPath();g.moveTo(x+i,h.y+h.h);g.lineTo(x+i+5,h.y-1);g.lineTo(x+i+10,h.y+h.h);g.fill()}
  }
  for(const c of coins){if(!c.got){const x=c.x-camera;if(x>-20&&x<W+20)drawCoinAt(x,c.y,clock,c.x)}}
  for(const e of enemies){if(e.alive){const x=e.x-camera;if(x>-40&&x<W+40)drawEnemySprite(e,x,e.y,clock)}}
  for(const o of orbs){if(!o.got)drawOrb(o.x-camera,o.y,clock)}
  for(const h of hearts){if(!h.got)drawHeart(h.x-camera,h.y,clock)}

  // checkpoint
  for(const c of checkpoints){
    const x=c.x-camera,wave=Math.sin(clock*.01)*2;
    box(x,300,5,65,'#eee9ce');
    box(x+5,301,27+wave,17,c.active?'#65f4ae':'#ff8aaf');box(x+8,304,7,5,'#fff');
  }
  // portal
  const gx=goalX-camera,pulse=Math.floor(clock/180)%2;
  box(gx-9,274,13,91,'#fff0a8');box(gx+48,274,13,91,'#fff0a8');box(gx-9,266,70,13,'#fff0a8');
  box(gx,282,48,83,world===1?'#7ef1ff':world===2?'#c6a4ff':'#64e7bd');
  box(gx+8,290,32,67,'#28234e');box(gx+13,295,22,57,pulse?'#fff8a0':'#fff2c0');box(gx+18,300,12,47,'#ff8bb2');
  box(gx-16,300+Math.sin(clock*.006)*14,4,4,'#fff6a8');box(gx+60,320+Math.cos(clock*.006)*14,4,4,'#fff6a8');

  for(const a of particles)box(a.x-camera,a.y,a.size,a.size,a.color);

  // pemain
  const p=player;
  if(!(p.inv>0&&Math.floor(clock/85)%2===0)){
    drawHero(p.x-camera,p.y,p.face,p.ground&&Math.abs(p.vx)>.4,clock,p.shield>0);
  }
  g.restore();
}

/* =====================================================================
   LATAR ANIMASI MENU
   ===================================================================== */
const MENU_BAND=48; // tinggi pita tanah (piksel logis)
let MW=800,MH=450,MG=GROUND,MS=1;
function resizeMenu(){
  const vw=window.innerWidth||800,vh=window.innerHeight||450;
  MS=clamp(Math.round(vh/500),1,3);
  MW=Math.max(240,Math.ceil(vw/MS));
  MH=Math.max(220,Math.ceil(vh/MS));
  MG=MH-MENU_BAND;
  mcv.width=MW;mcv.height=MH;
  mctx.imageSmoothingEnabled=false;
  document.documentElement.style.setProperty('--ground',(MENU_BAND*MS)+'px');
}
const menuHero={start:-10};
const MENU_TYPES=['slime','beetle','crystal','hopper'];
function drawMenu(now){
  g=mctx;
  const t=now/1000,scroll=t*90;
  const lane=(i,sp,cnt,off,speed)=>{const L=sp*cnt;return((((off+i*sp-scroll*speed)%L)+L)%L)-70};
  drawScene(MENU_THEME,scroll*.9,now,MW,MH,MG);
  drawGroundStrip(MENU_THEME,scroll,MW,MH,MG);

  // koin melayang rendah di atas tanah
  const cc=Math.ceil((MW+140)/160)+1;
  for(let i=0;i<cc;i++){
    const sx=lane(i,160,cc,100,1);
    if(sx<MW+20)drawCoinAt(sx,MG-72+Math.sin(t*3+i)*8,now,i*50);
  }
  // kelelawar & burung dekoratif di langit
  const fc=Math.ceil((MW+140)/380)+1;
  for(let i=0;i<fc;i++){
    const sx=lane(i,380,fc,60,1.25);
    if(sx<MW+20)drawEnemySprite({type:i%2?'bird':'bat',phase:i},sx,MG-160-(i%3)*34+Math.sin(t*1.5+i)*10,now);
  }
  // musuh darat + pahlawan yang melompatinya
  const ec=Math.ceil((MW+140)/440)+1,hx=Math.min(110,Math.round(MW*.14)),positions=[];
  for(let i=0;i<ec;i++){
    const type=MENU_TYPES[i%MENU_TYPES.length],eh=ENEMY_SIZE[type][1];
    const sx=lane(i,440,ec,520,1);
    positions.push(sx);
    if(sx<MW+20)drawEnemySprite({type,phase:i},sx,MG-eh,now);
  }
  const since=t-menuHero.start;
  if(since>1.3){for(const sx of positions){if(sx<hx+50&&sx>hx+36){menuHero.start=t;break}}}
  let hy=MG-39,air=false;
  if(since<1){const u=since;hy-=4*76*u*(1-u);air=true}
  drawHero(hx,hy,1,!air,now,false);

  // vinyet ringan agar kartu menu tetap terbaca, latar tetap terlihat
  const vg=g.createRadialGradient(MW/2,MH/2,MH*.4,MW/2,MH/2,Math.max(MW,MH)*.75);
  vg.addColorStop(0,'#05081800');vg.addColorStop(1,'#05081888');
  g.fillStyle=vg;g.fillRect(0,0,MW,MH);
}

/* =====================================================================
   LOOP UTAMA
   ===================================================================== */
function loop(now){
  const dt=Math.min((now-lastT)/1000||0,.1);
  lastT=now;
  if(mode==='play'){
    acc+=dt;
    while(acc>=STEP){step();acc-=STEP;if(mode!=='play'){acc=0;break}}
  }
  if(screen==='game')drawGame();else drawMenu(now);
  requestAnimationFrame(loop);
}

/* =====================================================================
   INPUT
   ===================================================================== */
const isTyping=t=>t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA');
const GAME_KEYS=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'];

document.addEventListener('keydown',e=>{
  if(isTyping(e.target))return;
  ensureAudio();
  if(e.code==='Escape'){
    if(screen==='menu'){closeModals();return}
    pauseGame();return;
  }
  if(mode==='play'||mode==='pause'){if(GAME_KEYS.includes(e.code))e.preventDefault()}
  if((e.code==='KeyP')&&(mode==='play'||mode==='pause')){pauseGame();return}
  if(mode!=='play')return;
  if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=true;
  if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){
    if(!e.repeat)jumpBuf=8;
    jumpHeld=true;
  }
});
document.addEventListener('keyup',e=>{
  if(isTyping(e.target))return;
  if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=false;
  if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){jumpHeld=false;if(mode==='play'&&e.code==='Space')e.preventDefault()}
});
window.addEventListener('blur',()=>{releaseKeys();if(mode==='play')pauseGame()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseKeys();if(mode==='play')pauseGame()}});

function bindHold(id,onDown,onUp){
  const b=$(id);
  b.addEventListener('pointerdown',e=>{e.preventDefault();ensureAudio();onDown();try{b.setPointerCapture(e.pointerId)}catch(_){}});
  for(const ev of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,onUp);
  b.addEventListener('contextmenu',e=>e.preventDefault());
}
bindHold('left',()=>{if(mode==='play'){keys.left=true}},()=>{keys.left=false});
bindHold('right',()=>{if(mode==='play'){keys.right=true}},()=>{keys.right=false});
bindHold('jump',()=>{if(mode==='play'){jumpBuf=8;jumpHeld=true}},()=>{jumpHeld=false});

// lepas fokus tombol di layar game agar Spasi tidak menekan tombol
document.addEventListener('click',e=>{if(screen==='game'){const b=e.target.closest('button');if(b)b.blur()}});

/* =====================================================================
   PASANG EVENT UI
   ===================================================================== */
$('regForm').addEventListener('submit',submitRegistration);
['inName','inAge','inSchool'].forEach(id=>$(id).addEventListener('input',()=>{
  $(id).closest('.field').classList.remove('invalid');
  $('err'+id.slice(2)).textContent='';
}));

$('playBtn').onclick=()=>{sfx.click();startGame(0,true)};
$('selectBtn').onclick=()=>{ensureAudio();sfx.click();$('worldModal').classList.remove('hidden')};
$('howBtn').onclick=()=>{ensureAudio();sfx.click();$('howModal').classList.remove('hidden')};
$('changeBtn').onclick=()=>{
  ensureAudio();sfx.click();submitScore();
  if(me){$('inName').value=me.name;$('inAge').value=me.age;$('inSchool').value=me.school}
  mode='register';setScreen('register');
};
$('menuMute').onclick=()=>{ensureAudio();setMuted(!muted);sfx.click()};
$('muteBtn').onclick=()=>{ensureAudio();setMuted(!muted);sfx.click()};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add('hidden'));
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('pointerdown',e=>{if(e.target===m)m.classList.add('hidden')}));

let clearArmed=0;
$('clearBoard').onclick=()=>{
  const b=$('clearBoard');
  if(!clearArmed){
    clearArmed=setTimeout(()=>{clearArmed=0;b.textContent='Reset peringkat'},3000);
    b.textContent='Klik lagi untuk menghapus semua skor';
  }else{
    clearTimeout(clearArmed);clearArmed=0;
    board=[];saveBoard();renderMenu();b.textContent='Reset peringkat';
  }
};

$('pauseBtn').onclick=pauseGame;
$('resumeBtn').onclick=pauseGame;
$('pauseRestart').onclick=()=>{
  $('pauseMenu').classList.add('hidden');
  retryWorld();
};
$('pauseHome').onclick=backToMenu;
$('endRetry').onclick=retryWorld;
$('endHome').onclick=backToMenu;
$('endPrimary').onclick=()=>{
  if(endKind==='clear')startGame(world+1,false);
  else if(endKind==='win')startGame(0,true);
  else retryWorld();
};

// judul bergerak huruf per huruf
document.querySelectorAll('.logo .row').forEach((row,r)=>{
  [...row.dataset.text].forEach((ch,i)=>{
    const s=el('span','ch',ch);
    s.style.setProperty('--i',i+r*5);
    row.appendChild(s);
  });
});
// kartu pilih dunia
WORLDS.forEach((w,i)=>{
  const t=THEMES[i],b=el('button','world-card');
  b.style.background='linear-gradient(160deg,'+t.sky1+','+t.far+' 60%,'+t.near+')';
  b.appendChild(el('span','num','DUNIA '+(i+1)));
  b.appendChild(el('span','ico',w.icon));
  b.appendChild(el('b','',w.name));
  b.appendChild(el('small','',w.desc));
  b.onclick=()=>{sfx.click();startGame(i,true)};
  $('worldCards').appendChild(b);
});

/* =====================================================================
   MULAI
   ===================================================================== */
board=loadBoard();
setMuted(store.get(KEY_MUTE)==='1');
try{
  const saved=JSON.parse(store.get(KEY_PLAYER)||'null');
  if(saved&&saved.name){
    $('inName').value=saved.name;
    $('inAge').value=saved.age;
    $('inSchool').value=saved.school;
  }
}catch(e){}
resizeMenu();
window.addEventListener('resize',resizeMenu);
buildWorld(0);
setScreen('register');
mode='register';
requestAnimationFrame(loop);
})();
