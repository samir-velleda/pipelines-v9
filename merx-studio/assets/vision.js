import { analyzeZone } from './domain.js?v=20261021g';

// Browser reference detector. This module never uploads camera frames.
// MERX-27: the detector loads as pinned ES modules instead of the legacy
// UMD bundle whose dynamic code evaluation is blocked by the portal CSP
// (script-src without 'unsafe-eval'). No eval/unsafe-eval is introduced.
// If a module arrives partially initialised, the cached promise is dropped
// and the globals are cleared so a retry works without reloading the page.
const TF_CORE_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.10.0/+esm';
const TF_CPU_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-padrão@4.10.0/+esm';
const COCO_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/+esm';
let modelPromise;
export function assertDetectorApi(tf, cocoSsd) {
  const valid = tf && typeof tf.ready === 'function' && typeof tf.setBackend === 'function' && cocoSsd && typeof cocoSsd.load === 'function';
  if (!valid) throw new Error('O motor de visão carregou de forma incompleta. Tente novamente — não é preciso recarregar a página.');
  return true;
}
export async function loadDetector(onStatus=()=>{}) {
  if(!modelPromise)modelPromise=(async()=>{
    onStatus('Carregando o motor de visão…');
    let tf, cocoSsd;
    try {
      tf = await import(/* @vite-ignore */TF_CORE_URL);
      await import(/* @vite-ignore */TF_CPU_URL);
      cocoSsd = await import(/* @vite-ignore */COCO_URL);
    } catch {
      throw new Error('Não foi possível carregar o detector. Verifique a conexão com a internet e tente novamente.');
    }
    assertDetectorApi(tf, cocoSsd);
    // The processamento padrão backend avoids device-specific shader code generation paths.
    try { await tf.setBackend('std'); } catch { /* keep the default backend */ }
    await tf.ready();
    onStatus('Baixando o modelo de referência…');
    const model=await cocoSsd.load({base:'lite_mobilenet_v2'});
    if(!model || typeof model.detect !== 'function') throw new Error('O modelo de visão não iniciou corretamente. Tente novamente.');
    return {model, backend:'processamento padrão do navegador (referência)'};
  })().catch(error=>{modelPromise=null; delete globalThis.tf; delete globalThis.cocoSsd; throw error;});
  return modelPromise;
}

const LABELS={presence:'Presença na área',dwell:'Permanência atingida',line_crossing:'Linha cruzada'};
const asPoint=value=>Array.isArray(value)?{x:value[0],y:value[1]}:value;
const side=(point,a,b)=>(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function crossedSegment(previous,current,line) {
  const a=line.start,b=line.end,s1=side(previous,a,b),s2=side(current,a,b);
  if(s1*s2>=0||Math.abs(s1-s2)<1e-9)return false;
  const u=s1/(s1-s2),intersection={x:previous.x+u*(current.x-previous.x),y:previous.y+u*(current.y-previous.y)};
  const length=(b.x-a.x)**2+(b.y-a.y)**2;
  if(length<1e-8)return false;
  const along=((intersection.x-a.x)*(b.x-a.x)+(intersection.y-a.y)*(b.y-a.y))/length;
  return along>=0&&along<=1;
}
function directionAllowed(previous,current,direction) {
  return direction==='both'||direction==='left_to_right'&&current.x>previous.x||direction==='right_to_left'&&current.x<previous.x||direction==='top_to_bottom'&&current.y>previous.y||direction==='bottom_to_top'&&current.y<previous.y;
}

/** Experimental centroid tracker for a browser test session, not identity recognition. */
export class RuleEngine {
  constructor(configuration){this.configuration=structuredClone(configuration);this.configuration.line={start:asPoint(this.configuration.line.start),end:asPoint(this.configuration.line.end)};this.reset();}
  reset(){this.tracks=new Map();this.nextId=1;this.lastAt=null;}
  process(detections,width,height,at,wallTime=Date.now()) {
    const c=this.configuration;
    if(!Number.isFinite(at)||at<0||!Number.isFinite(width)||!Number.isFinite(height)||!(width>0&&height>0)||!Number.isFinite(wallTime)||Math.abs(wallTime)>8.64e15)return {detections:[],events:[]};
    // A seek, suspension, or a long frame gap starts a new temporal observation.
    if(this.lastAt!==null&&(at<this.lastAt||at-this.lastAt>2500))this.reset();
    this.lastAt=at;
    for(const [id,track] of this.tracks)if(at-track.lastSeen>1200)this.tracks.delete(id);
    const matches=(Array.isArray(detections)?detections:[]).filter(d=>d&&c.classNames.includes(d.class)&&Number.isFinite(d.score)&&d.score>=c.confidence&&d.score<=1&&Array.isArray(d.bbox)&&d.bbox.length===4&&d.bbox.every(Number.isFinite)&&d.bbox[2]>0&&d.bbox[3]>0).slice(0,50);
    const available=new Set(this.tracks.keys()),assigned=[],events=[];
    for(const detection of matches){
      const [x,y,w,h]=detection.bbox;
      const center={x:(x+w/2)/width,y:(y+h/2)/height};
      if(!Number.isFinite(center.x)||!Number.isFinite(center.y))continue;
      let nearest=null,minDistance=.20;
      for(const id of available){const track=this.tracks.get(id);if(track.className!==detection.class)continue;const delta=distance(center,track.center);if(delta<minDistance){minDistance=delta;nearest=track;}}
      const track=nearest||{id:this.nextId++,className:detection.class,center,firstSeen:at,lastSeen:at,insideSince:null,insideFrames:0,frames:0,emitted:false};
      const previous={...track.center},wasSeen=track.frames>0;
      available.delete(track.id);track.center=center;track.lastSeen=at;track.frames+=1;
      const inside=analyzeZone(center,c.zone);
      if(inside){if(track.insideSince===null)track.insideSince=at;track.insideFrames+=1;}else{track.insideSince=null;track.insideFrames=0;track.emitted=false;}
      const elapsed=track.insideSince===null?0:(at-track.insideSince)/1000;
      let ready=false;
      if(c.mode==='presence')ready=inside&&track.insideFrames>=c.minFrames&&!track.emitted;
      if(c.mode==='dwell')ready=inside&&elapsed>=c.minDurationSeconds&&track.insideFrames>=c.minFrames&&!track.emitted;
      if(c.mode==='line_crossing'){
        // Preserve the last point off the line: A -> on-line -> B is a crossing.
        const offLine=Math.abs(side(center,c.line.start,c.line.end))>1e-9;
        const anchor=track.lineAnchor||previous;
        ready=offLine&&wasSeen&&track.frames>=c.minFrames&&crossedSegment(anchor,center,c.line)&&directionAllowed(anchor,center,c.direction);
        if(offLine)track.lineAnchor={...center};
      }
      // MERX-17: cooldown is per trajectory, so simultaneous crossings count separately.
      if(ready&&at-(track.lastEventAt??-Infinity)>=c.cooldownSeconds*1000){
        events.push({type:c.mode,label:LABELS[c.mode],trackId:track.id,className:track.className,confidence:detection.score,duration:c.mode==='dwell'?elapsed:undefined,at:new Date(wallTime).toISOString(),sourceTimestampMs:at,environment:'browser-reference',deviceQualified:false});
        track.lastEventAt=at;track.emitted=true;
      }
      this.tracks.set(track.id,track);assigned.push({...detection,trackId:track.id,inside,duration:elapsed});
    }
    // A missed observation breaks a consecutive-frame confirmation and a dwell interval.
    for(const id of available){const track=this.tracks.get(id);track.insideFrames=0;track.insideSince=null;track.frames=0;track.lineAnchor=null;}
    return {detections:assigned,events};
  }
}

export function drawOverlay(canvas,source,configuration,detections=[],draft=null) {
  if(!canvas||!source)return;
  const width=source.videoWidth||source.naturalWidth||800,height=source.videoHeight||source.naturalHeight||450;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,width,height);const scale=Math.max(1,width/800);
  ctx.lineWidth=2*scale;ctx.strokeStyle='#0071e3';ctx.fillStyle='rgba(0,113,227,.06)';ctx.setLineDash([7*scale,5*scale]);
  if(configuration.mode==='line_crossing'){
    const rawLine=draft?.line||configuration.line,line={start:asPoint(rawLine.start),end:asPoint(rawLine.end)};ctx.beginPath();ctx.moveTo(line.start.x*width,line.start.y*height);ctx.lineTo(line.end.x*width,line.end.y*height);ctx.stroke();
    for(const point of [line.start,line.end]){ctx.beginPath();ctx.arc(point.x*width,point.y*height,4*scale,0,Math.PI*2);ctx.fillStyle='#0071e3';ctx.fill();}
  }else{
    const zone=draft?.zone||configuration.zone;ctx.beginPath();
    if(Array.isArray(zone)){zone.map(asPoint).forEach((p,i)=>i?ctx.lineTo(p.x*width,p.y*height):ctx.moveTo(p.x*width,p.y*height));ctx.closePath();}
    else ctx.rect(zone.x*width,zone.y*height,zone.width*width,zone.height*height);
    ctx.fill();ctx.stroke();
  }
  ctx.setLineDash([]);ctx.font=`${13*scale}px -apple-system,Arial,sans-serif`;
  const classes={person:'Pessoa',car:'Carro',truck:'Caminhão',bus:'Ônibus',motorcycle:'Moto',bicycle:'Bicicleta',dog:'Cão',cat:'Gato',backpack:'Mochila',handbag:'Bolsa',suitcase:'Mala'};
  for(const detection of detections){const [x,y,w,h]=detection.bbox;ctx.strokeStyle=detection.inside?'#00a37a':'#0071e3';ctx.strokeRect(x,y,w,h);const label=`${classes[detection.class]||detection.class} · ${Math.round(detection.score*100)}%${detection.trackId?' · #'+detection.trackId:''}`;const labelWidth=ctx.measureText(label).width+14*scale,labelY=Math.max(0,y-24*scale);ctx.fillStyle=ctx.strokeStyle;ctx.fillRect(x,labelY,labelWidth,24*scale);ctx.fillStyle='#fff';ctx.fillText(label,x+7*scale,labelY+17*scale);}
}
