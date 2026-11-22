/* Voix du commentateur (Piper, voix française Siwis) : tourne à part pour ne pas ralentir l'image */
importScripts('ort.wasm.min.js','piper_phonemize.js');
let sess=null,cfg=null,base='',dataBuf=null,wasmBuf=null,readyP=null;
async function init(b){base=b;ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=b;
 const [c,m,d,w]=await Promise.all([fetch(b+'voix-fr.json').then(r=>r.json()),fetch(b+'voix-fr.onnx').then(r=>r.arrayBuffer()),fetch(b+'piper_phonemize.data').then(r=>r.arrayBuffer()),fetch(b+'piper_phonemize.wasm').then(r=>r.arrayBuffer())]);
 cfg=c;dataBuf=d;wasmBuf=w;sess=await ort.InferenceSession.create(m,{executionProviders:['wasm']});}
function phon(text){return new Promise((res,rej)=>{let done=false;
 createPiperPhonemize({wasmBinary:wasmBuf,getPreloadedPackage:()=>dataBuf,print:d=>{if(!done){done=true;try{res(JSON.parse(d).phoneme_ids);}catch(e){rej(e);}}},printErr:()=>{},
  locateFile:u=>u.endsWith('.wasm')?base+'piper_phonemize.wasm':u.endsWith('.data')?base+'piper_phonemize.data':u})
 .then(M=>{M.callMain(['-l',cfg.espeak.voice,'--input',JSON.stringify([{text}]),'--espeak_data','/espeak-ng-data']);setTimeout(()=>{if(!done)rej(new Error('phon'));},3000);}).catch(rej);});}
async function say(text,rate){await readyP;const parts=text.replace(/\s+/g,' ').split(/(?<=[.!?…])\s+/).filter(s=>s.trim());const out=[];
 for(const t of parts){let ids=await phon(t);ids=ids.filter(i=>i<cfg.num_symbols);if(!ids.length)continue;const n=ids.length;
  const feeds={input:new ort.Tensor('int64',BigInt64Array.from(ids.map(BigInt)),[1,n]),input_lengths:new ort.Tensor('int64',BigInt64Array.from([BigInt(n)]),[1]),
   scales:new ort.Tensor('float32',Float32Array.from([cfg.inference.noise_scale,(cfg.inference.length_scale||1)/(rate||1),cfg.inference.noise_w]),[3])};
  if(cfg.num_speakers>1)feeds.sid=new ort.Tensor('int64',BigInt64Array.from([0n]),[1]);
  const r=await sess.run(feeds);out.push(r.output.data);out.push(new Float32Array(Math.round(cfg.audio.sample_rate*.18)));}
 const len=out.reduce((a,b)=>a+b.length,0);const pcm=new Float32Array(len);let o=0;for(const p of out){pcm.set(p,o);o+=p.length;}return pcm;}
onmessage=async e=>{const m=e.data;
 if(m.t==='init'){readyP=init(m.base);readyP.then(()=>postMessage({t:'ready'}),err=>postMessage({t:'err',m:String(err&&err.message||err)}));}
 else if(m.t==='say'){try{const pcm=await say(m.text,m.rate);postMessage({t:'pcm',id:m.id,pcm,sr:cfg.audio.sample_rate},[pcm.buffer]);}catch(err){postMessage({t:'pcm',id:m.id,pcm:null,err:String(err&&err.message||err)});}}};
