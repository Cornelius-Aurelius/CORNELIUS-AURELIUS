const targets=[40,45,50,55,59,64].map(n=>440*2**((n-69)/12)), names=['Low E','A','D','G','B','High E'];
const cents=(f,t)=>1200*Math.log2(f/t);
// YIN cumulative mean normalized difference, with parabolic interpolation.
function detect(input,sr){
 const stride=sr>=40000?2:1,rate=sr/stride,n=Math.floor(input.length/stride),x=new Float32Array(n);let mean=0,energy=0;
 for(let i=0;i<n;i++){let v=0;for(let k=0;k<stride;k++)v+=input[i*stride+k];x[i]=v/stride;mean+=x[i]}
 mean/=n;for(let i=0;i<n;i++){x[i]-=mean;energy+=x[i]*x[i]}
 if(Math.sqrt(energy/n)<.0014)return null;
 const min=Math.floor(rate/500),max=Math.min(Math.floor(rate/55),Math.floor(n/2)-2),w=n-max;
 if(max<=min+2)return null;
 const d=new Float64Array(max+1);d[0]=1;let total=0;
 for(let t=1;t<=max;t++){let v=0;for(let j=0;j<w;j++){const z=x[j]-x[j+t];v+=z*z}total+=v;d[t]=total?v*t/total:1}
 let p=-1;for(let t=min;t<max;t++){if(d[t]<.12){while(t<max-1&&d[t+1]<d[t])t++;p=t;break}}
 if(p<0)return null;
 const first=p;for(let m=2;m<=4;m++){const center=first*m;if(center>=max-2)break;let q=center;for(let t=Math.max(min,Math.floor(center*.97));t<=Math.min(max-1,Math.ceil(center*1.03));t++)if(d[t]<d[q])q=t;if(d[q]<d[p]*.55&&d[p]-d[q]>.012)p=q}
 if(d[p]>.10)return null;
 const base=p*stride,limit=input.length-base-5;if(limit<256)return null;
 function score(t){let aa=0,bb=0,ab=0,am=0,bm=0;for(let j=0;j<limit;j++){let u=input[j],v=input[j+t];aa+=u*u;bb+=v*v;ab+=u*v;am+=u;bm+=v}return (ab-am*bm/limit)/Math.sqrt(Math.max(1e-24,(aa-am*am/limit)*(bb-bm*bm/limit)))}
 let q=base,best=-1;for(let t=base-3;t<=base+3;t++){let s=score(t);if(s>best){best=s;q=t}}
 if(best<.9||q===base-3||q===base+3)return null;
 const l=score(q-1),h=score(q+1),den=l-2*best+h;
 const shift=den?Math.max(-.5,Math.min(.5,.5*(l-h)/den)):0;
 return sr/(q+shift);
}
function tracking(){
 let selected=-1,candidate=-1,count=0,history=[],samples=[],filtered=0,lastSeen=0,validAt=null,confirmed=false,armed=true,offSince=null,previousGood=false,lastRaw=null;
 const done=new Set();
 function reset(clear=false){selected=-1;candidate=-1;count=0;history=[];samples=[];filtered=0;lastSeen=0;validAt=null;confirmed=false;armed=true;offSince=null;previousGood=false;lastRaw=null;if(clear)done.clear()}
 function step(f,now,manual=-1){
  let event=false,progress=0,signal=false,raw=null;
  let i=manual>=0?manual:f?targets.reduce((best,t,j)=>Math.abs(cents(f,t))<Math.abs(cents(f,targets[best]))?j:best,0):-1;
  if(f&&i>=0)raw=cents(f,targets[i]);
  if(!f||i<0||Math.abs(raw)>180){
   validAt=null;samples=[];candidate=-1;count=0;offSince=null;
   const recent=previousGood&&now-lastSeen<=1800&&!f;
   if(now-lastSeen>1800){confirmed=false;selected=-1;history=[];armed=true;previousGood=false}
   if(f){confirmed=false;previousGood=false}
   return {selected,filtered,history,confirmed:recent,signal,event,progress,done,f:null,raw:null}
  }
  if(i!==candidate){candidate=i;count=1;validAt=null;samples=[];previousGood=false;return {selected,filtered,history,confirmed:false,signal,event,progress,done,f:null,raw:null}}
  count++;
  if(i!==selected){selected=i;history=[];samples=[];filtered=raw;confirmed=false;armed=true;offSince=null;validAt=null;lastSeen=0;previousGood=false;lastRaw=null}
  if(lastSeen&&now-lastSeen>140){samples=[];validAt=null;previousGood=false;confirmed=false}
  lastSeen=now;signal=true;
  samples.push(raw);if(samples.length>3)samples.shift();const ordered=[...samples].sort((a,b)=>a-b),med=ordered[Math.floor(ordered.length/2)];
  const e=med-filtered;filtered+=(Math.abs(e)>8?.8:Math.abs(e)>2?.57:.36)*e;
  const inTune=Math.abs(raw)<=2&&Math.abs(med)<=2&&Math.abs(filtered)<=2;
  if(inTune){if(validAt===null)validAt=now;progress=Math.min(1,(now-validAt)/500)}else validAt=null;
  if(!inTune){confirmed=false;if(Math.abs(raw)>3){if(offSince===null)offSince=now;if(now-offSince>=150){armed=true;done.delete(i)}}else offSince=null}
  else offSince=null;
  if(progress>=1){confirmed=true;done.add(i);if(armed){event=true;armed=false}}
  previousGood=confirmed&&inTune;lastRaw=raw;
  history.push({c:filtered,t:now});while(history.length&&history[0].t<now-1800)history.shift();
  return {selected,filtered,history,confirmed:previousGood,signal,event,progress,done,f,raw}
 }
 return {reset,step,done};
}
if(typeof module!=='undefined')module.exports={detect,targets,cents,tracking};
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id),cv=$('graph'),ctx=cv.getContext('2d'),buttons=[...document.querySelectorAll('.peg')],tracker=tracking();
let ac,stream,an,buf,running=false,busy=false,manual=-1,sound=true,last=0,mute=0,state=tracker.step(null,0),visual=0,frame=0,lastRender=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function draw(now=0){
 const rect=cv.getBoundingClientRect(),p=Math.min(2,window.devicePixelRatio||1),w=rect.width,h=rect.height;if(!w||!h)return;
 if(cv.width!==Math.round(w*p)||cv.height!==Math.round(h*p)){cv.width=Math.round(w*p);cv.height=Math.round(h*p)}
 const elapsed=lastRender?Math.min(100,now-lastRender):16;lastRender=now;
 visual+= (state.filtered-visual)*(1-Math.exp(-elapsed/65));
 ctx.setTransform(p,0,0,p,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#080d14';ctx.fillRect(0,0,w,h);
 const pad=18,span=w-2*pad,x=v=>{const a=clamp(Math.abs(v),0,50);return w/2+Math.sign(v)*span/2*(a<=10?a*.055:.55+(a-10)*.45/40)},y0=24;
 const good=state.confirmed,col=good?'#43ff75':state.progress>0?'#ffd566':'#42d5ff';
 ctx.fillStyle=good?'#43ff752c':'#43ff7512';ctx.fillRect(x(-2),0,x(2)-x(-2),h);
 for(const n of [-50,-40,-30,-20,-10,-8,-6,-4,-2,0,2,4,6,8,10,20,30,40,50]){ctx.strokeStyle=[-50,-10,0,10,50].includes(n)?'#36566a':'#192b38';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(n),0);ctx.lineTo(x(n),h);ctx.stroke()}
 for(let k=1;k<5;k++){ctx.strokeStyle='#192b38';ctx.beginPath();ctx.moveTo(0,h*k/5);ctx.lineTo(w,h*k/5);ctx.stroke()}
 ctx.strokeStyle=good?'#43ff75':'#d0dce4';ctx.lineWidth=good?3:2;ctx.beginPath();ctx.moveTo(x(0),0);ctx.lineTo(x(0),h);ctx.stroke();
 if(state.selected<0||!state.history.length)return;
 ctx.strokeStyle=col;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();const newest=state.history[state.history.length-1].t;
 state.history.forEach((v,i)=>{const y=y0+(h-y0-7)*clamp((newest-v.t)/1800,0,1);i?ctx.lineTo(x(v.c),y):ctx.moveTo(x(v.c),y)});ctx.lineTo(x(visual),y0);ctx.stroke();
 const px=good?x(0):x(visual);if(good){ctx.strokeStyle='#43ff75';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,y0,19,0,Math.PI*2);ctx.stroke()}ctx.shadowColor=col;ctx.shadowBlur=good?16:6;ctx.fillStyle=col;ctx.beginPath();ctx.arc(px,y0,good?15:9,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 if(good){ctx.lineWidth=3;ctx.strokeStyle='#092718';ctx.beginPath();ctx.moveTo(px-6,y0);ctx.lineTo(px-2,y0+5);ctx.lineTo(px+7,y0-5);ctx.stroke()}
}
function display(){
 const i=state.selected;
 buttons.forEach(b=>{const n=+b.dataset.i;b.classList.toggle('active',n===i||n===manual);b.classList.toggle('done',tracker.done.has(n));b.setAttribute('aria-pressed',n===manual)});
 $('auto').textContent=manual<0?'Auto ✓':'Auto';$('chime').textContent='Chime '+(sound?'ON':'OFF');
 $('status').classList.toggle('good',state.confirmed);$('graph').parentElement.classList.toggle('locked',state.confirmed);
 $('progress').style.width=(state.confirmed?100:state.progress*100)+'%';
 if(i<0){$('status').textContent=running?(manual<0?'Pluck one string':'Pluck '+names[manual]):'Start tuning';$('reading').textContent=running?'Listening…':'Microphone not started'}
 else if(state.confirmed){$('status').textContent='✓ '+names[i]+' IN TUNE';$('reading').textContent=state.signal?state.raw.toFixed(1)+' cents · '+state.f.toFixed(2)+' / '+targets[i].toFixed(2)+' Hz':'Tuning confirmed · pluck next string'}
 else if(!state.signal){$('status').textContent='Pluck '+names[i]+' again';$('reading').textContent='Waiting for a clear note…'}
 else{$('status').textContent=names[i]+' · '+(Math.abs(state.filtered)<=2?'Hold steady':state.filtered<0?'TIGHTEN ↑':'LOOSEN ↓');$('reading').textContent=(state.filtered>0?'+':'')+state.filtered.toFixed(1)+' cents · '+state.f.toFixed(2)+' / '+targets[i].toFixed(2)+' Hz'}
 $('msg').textContent=tracker.done.size===6?'✓ All six strings checked · recheck if needed':tracker.done.size+'/6 strings checked · '+(manual<0?'Auto detect':'Manual string');
}
function chime(){
 if(sound&&ac){const t=ac.currentTime;[880,1174.66,1318.51].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain(),at=t+i*.12;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.10,at+.015);g.gain.exponentialRampToValueAtTime(.0001,at+.19);o.connect(g).connect(ac.destination);o.start(at);o.stop(at+.20)});mute=performance.now()+550}
 if(navigator.vibrate)navigator.vibrate([80,60,120]);
}
function tick(now){if(!running)return;frame=requestAnimationFrame(tick);if(now-last>=50&&now>=mute){last=now;an.getFloatTimeDomainData(buf);const f=detect(buf,ac.sampleRate);const old=state.selected;state=tracker.step(f,now,manual);if(state.selected!==old)visual=state.filtered;if(state.event)chime();display()}draw(now)}
function reset(clear=false){tracker.reset(clear);state=tracker.step(null,performance.now(),manual);visual=0;last=0;mute=0;display();draw(performance.now())}
async function stop(){running=false;cancelAnimationFrame(frame);if(stream)stream.getTracks().forEach(t=>t.stop());if(ac&&ac.state!=='closed')await ac.close();stream=null;ac=null;$('start').textContent='Start microphone';reset(true)}
$('start').onclick=async()=>{if(busy)return;busy=true;try{if(running){await stop();return}ac=new (window.AudioContext||window.webkitAudioContext)();await ac.resume();stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});an=ac.createAnalyser();an.fftSize=4096;buf=new Float32Array(an.fftSize);ac.createMediaStreamSource(stream).connect(an);running=true;reset(true);$('start').textContent='Stop microphone';frame=requestAnimationFrame(tick)}catch(e){await stop();$('msg').textContent='Allow microphone permission in your browser.'}finally{busy=false}};
buttons.forEach(b=>b.onclick=()=>{manual=+b.dataset.i;reset()});$('auto').onclick=()=>{manual=-1;reset()};$('chime').onclick=()=>{sound=!sound;display()};window.addEventListener('pagehide',()=>{if(running)stop()});window.addEventListener('resize',()=>draw(performance.now()));display();draw(performance.now());if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{});
}