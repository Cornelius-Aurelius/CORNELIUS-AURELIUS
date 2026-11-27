const targets=[40,45,50,55,59,64].map(n=>440*2**((n-69)/12)), names=['Low E','A','D','G','B','High E'];
const cents=(f,t)=>1200*Math.log2(f/t);
// YIN cumulative mean normalized difference, with parabolic interpolation.
function detect(input,sr){
 const stride=sr>=40000?2:1,rate=sr/stride,n=Math.floor(input.length/stride),x=new Float32Array(n);let mean=0,energy=0;
 for(let i=0;i<n;i++){let v=0;for(let k=0;k<stride;k++)v+=input[i*stride+k];x[i]=v/stride;mean+=x[i]}
 mean/=n;for(let i=0;i<n;i++){x[i]-=mean;energy+=x[i]*x[i]}
 if(Math.sqrt(energy/n)<.0018)return null;
 const min=Math.floor(rate/500),max=Math.min(Math.floor(rate/55),Math.floor(n/2)-2),w=n-max;
 if(max<=min+2)return null;
 const d=new Float64Array(max+1);d[0]=1;let total=0;
 for(let t=1;t<=max;t++){let v=0;for(let j=0;j<w;j++){const z=x[j]-x[j+t];v+=z*z}total+=v;d[t]=total?v*t/total:1}
 let p=-1;for(let t=min;t<max;t++){if(d[t]<.13){while(t<max-1&&d[t+1]<d[t])t++;p=t;break}}if(p<0)return null;
 const first=p;for(let m=2;m<=4;m++){const center=first*m;if(center>=max-2)break;let q=center;for(let t=Math.max(min,Math.floor(center*.97));t<=Math.min(max-1,Math.ceil(center*1.03));t++)if(d[t]<d[q])q=t;if(d[q]<d[p]*.48&&d[p]-d[q]>.018)p=q}
 const a=d[p-1],b=d[p],c=d[p+1],den=a-2*b+c;
 return rate/(p+(den?Math.max(-.5,Math.min(.5,.5*(a-c)/den)):0));
}
if(typeof module!=='undefined')module.exports={detect,targets,cents};
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id),cv=$('graph'),ctx=cv.getContext('2d'),buttons=[...document.querySelectorAll('.peg')];let ac,stream,an,buf,running=false,manual=-1,selected=-1,history=[],values=[],filtered=0,hold=0,last=0,good=false,played=false,sound=true,done=new Set(),candidate=-1,count=0,mutedUntil=0,lastSignal=0,confirmedAt=0;
function draw(){
 const r=cv.getBoundingClientRect(),p=Math.min(2,devicePixelRatio||1),w=r.width,h=r.height;if(!w||!h)return;
 if(cv.width!==Math.round(w*p)||cv.height!==Math.round(h*p)){cv.width=Math.round(w*p);cv.height=Math.round(h*p)}
 ctx.setTransform(p,0,0,p,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#080d14';ctx.fillRect(0,0,w,h);
 const x=v=>w/2+Math.max(-50,Math.min(50,v))*w/100,top=16,bottom=h-7;
 ctx.fillStyle='#43ff751b';ctx.fillRect(x(-2),0,x(2)-x(-2),h);
 for(let c=-50;c<=50;c+=5){ctx.strokeStyle=c%25===0?'#355064':'#172b38';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(c),0);ctx.lineTo(x(c),h);ctx.stroke()}
 for(let k=1;k<5;k++){ctx.strokeStyle='#172b38';ctx.beginPath();ctx.moveTo(0,h*k/5);ctx.lineTo(w,h*k/5);ctx.stroke()}
 ctx.strokeStyle=good?'#43ff75':'#8ba5b7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(0),0);ctx.lineTo(x(0),h);ctx.stroke();
 if(!history.length)return;
 const col=good?'#43ff75':Math.abs(filtered)<=2?'#f5d65c':'#44cfff';
 ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=col;ctx.beginPath();
 history.forEach((v,i)=>{const y=top+(bottom-top)*(history.length-1-i)/35;i?ctx.lineTo(x(v),y):ctx.moveTo(x(v),y)});ctx.stroke();
 const px=x(filtered);ctx.shadowColor=col;ctx.shadowBlur=7;ctx.fillStyle=col;ctx.beginPath();ctx.arc(px,top,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 if(good){ctx.strokeStyle='#082716';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px-4,top);ctx.lineTo(px-1,top+3);ctx.lineTo(px+4,top-3);ctx.stroke()}
}
function display(){buttons.forEach(b=>{let i=+b.dataset.i;b.classList.toggle('active',i===selected||i===manual);b.classList.toggle('done',done.has(i));b.setAttribute('aria-pressed',i===manual)});$('auto').textContent=manual<0?'Auto ✓':'Auto';$('chime').textContent='Chime '+(sound?'ON':'OFF');$('msg').textContent=done.size===6?'All six strings checked · recheck if needed':`${done.size}/6 strings tuned · pluck one open string`}
function reset(){lastSignal=0;confirmedAt=0;history=[];values=[];hold=0;good=false;played=false;last=0;candidate=-1;count=0;selected=-1;draw()}
function chime(){if(!sound)return;let o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.15);o.connect(g).connect(ac.destination);o.start();o.stop(t+.16);mutedUntil=performance.now()+220}
function tick(now){if(!running)return;requestAnimationFrame(tick);if(now-last<60||now<mutedUntil)return;let dt=last?now-last:0;last=now;an.getFloatTimeDomainData(buf);let f=detect(buf,ac.sampleRate);if(!f){hold=0;if(now-lastSignal<300||(good&&now-confirmedAt<1200))return;good=false;values=[];history=[];played=false;candidate=-1;count=0;selected=-1;$('status').textContent=manual<0?'Pluck one string':'Pluck '+names[manual];$('status').classList.remove('good');$('reading').textContent='Listening…';display();draw();return}let i=manual>=0?manual:targets.reduce((best,t,j)=>Math.abs(cents(f,t))<Math.abs(cents(f,targets[best]))?j:best,0);let c=cents(f,targets[i]);if(Math.abs(c)>220){hold=0;good=false;history=[];$('status').textContent='Pitch outside tuning range';$('status').classList.remove('good');$('reading').textContent=f.toFixed(2)+' Hz';draw();return}if(i!==candidate){candidate=i;count=1;hold=0;good=false;$('status').classList.remove('good');$('status').textContent='Detecting '+names[i]+'…';$('reading').textContent=f.toFixed(2)+' Hz';return}if(++count<2)return;lastSignal=now;if(i!==selected){selected=i;history=[];values=[];hold=0;played=false;filtered=c}values.push(c);if(values.length>5)values.shift();let median=[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];let err=median-filtered,alpha=Math.abs(err)>10?.73:Math.abs(err)>3?.45:.24;filtered+=alpha*err;history.push(filtered);if(history.length>36)history.shift();if(Math.abs(c)<=2&&Math.abs(median)<=2&&Math.abs(filtered)<=2&&dt<150){hold+=dt}else{hold=0;if(Math.abs(c)>3.5||Math.abs(filtered)>3){played=false;good=false}}if(hold>=500&&!good){good=true;confirmedAt=now}if(good&&!played){done.add(i);played=true;chime()}$('status').textContent=good?'✓ '+names[i]+' in tune':names[i]+(Math.abs(filtered)<=2?' · hold steady':filtered<0?' · tighten':' · loosen');$('status').classList.toggle('good',good);$('reading').textContent=(filtered>=0?'+':'')+filtered.toFixed(1)+' cents · '+f.toFixed(2)+' Hz / '+targets[i].toFixed(2)+' Hz';display();draw()}
$('start').onclick=async()=>{if(running){running=false;stream.getTracks().forEach(t=>t.stop());await ac.close();reset();$('start').textContent='Start microphone';$('status').textContent='Pluck one string';$('status').classList.remove('good');$('reading').textContent='Microphone stopped';return}try{ac=new (window.AudioContext||window.webkitAudioContext)();await ac.resume();stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});an=ac.createAnalyser();an.fftSize=4096;buf=new Float32Array(an.fftSize);ac.createMediaStreamSource(stream).connect(an);running=true;$('start').textContent='Stop microphone';requestAnimationFrame(tick)}catch(e){if(ac)ac.close();$('msg').textContent='Microphone needs permission and a secure HTTPS page.'}};buttons.forEach(b=>b.onclick=()=>{manual=+b.dataset.i;reset();display()});$('auto').onclick=()=>{manual=-1;reset();display()};$('chime').onclick=()=>{sound=!sound;display()};window.addEventListener('pagehide',()=>{if(stream)stream.getTracks().forEach(t=>t.stop());running=false});window.addEventListener('resize',draw);draw();display();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
}
