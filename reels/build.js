// Build 9:16 Reels from the square ads in ../pubs-2026-11 using Node + Playwright + ffmpeg.
// Usage: npm run build   (outputs to ./out)
const {chromium}=require('playwright');
const {execFileSync}=require('child_process');
const fs=require('fs'),path=require('path');

const SRC=path.join(__dirname,'..','pubs-2026-11');
const OUT=path.join(__dirname,'out');
const MUSIC=process.env.MUSIC||''; // optional audio file for the reels
const PER=8, FPS=30, SLIDE=3.5, FADE=0.5;

const ff=args=>execFileSync('ffmpeg',['-v','error','-y',...args],{stdio:'inherit'});

async function overlay(){
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1080,height:1920}});
  await p.goto('file://'+path.join(__dirname,'overlay.html'));
  await p.waitForTimeout(1500);
  await p.screenshot({path:path.join(OUT,'overlay.png'),omitBackground:true});
  await b.close();
}

// blurred background + slowly zooming square post + branded overlay
function scene(dur){
  const n=Math.round(dur*FPS);
  return `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:3,eq=brightness=-0.08[bg];`+
    `[0:v]scale=2160:2160,zoompan=z='1+0.06*on/${n}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${n}:s=1080x1080:fps=${FPS}[fg];`+
    `[bg][fg]overlay=0:420[v0];[v0][1:v]overlay=0:0,format=yuv420p`;
}

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  await overlay();
  const ov=path.join(OUT,'overlay.png');
  const imgs=fs.readdirSync(SRC).filter(f=>/\.jpe?g$/i.test(f)).sort();

  for(const f of imgs){
    const name=path.parse(f).name, out=path.join(OUT,`reel_${name}.mp4`);
    ff(['-loop','1','-t',String(PER),'-i',path.join(SRC,f),'-i',ov,...(MUSIC?['-i',MUSIC]:[]),
      '-filter_complex',scene(PER),'-t',String(PER),'-r',String(FPS),'-c:v','libx264','-crf','20','-preset','medium',
      ...(MUSIC?['-map','2:a','-af',`afade=t=out:st=${PER-1}:d=1`,'-c:a','aac','-shortest']:[]),'-movflags','+faststart',out]);
    console.log('✓',path.basename(out));
  }

  // one combined reel: every ad with crossfades
  const inputs=[],fc=[];
  imgs.forEach((f,i)=>{inputs.push('-loop','1','-t',String(SLIDE),'-i',path.join(SRC,f));});
  inputs.push('-i',ov);
  const oi=imgs.length;
  imgs.forEach((f,i)=>{
    const n=Math.round(SLIDE*FPS);
    fc.push(`[${i}:v]split[s${i}a][s${i}b];[s${i}a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:3,eq=brightness=-0.08[bg${i}];`+
      `[s${i}b]scale=2160:2160,zoompan=z='1+0.05*on/${n}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${n}:s=1080x1080:fps=${FPS}[fg${i}];`+
      `[bg${i}][fg${i}]overlay=0:420,fps=${FPS},settb=AVTB,format=yuv420p[c${i}]`);
  });
  let last='c0',off=0;
  for(let i=1;i<imgs.length;i++){off+=SLIDE-FADE;fc.push(`[${last}][c${i}]xfade=transition=slideleft:duration=${FADE}:offset=${off.toFixed(2)}[x${i}]`);last=`x${i}`;}
  fc.push(`[${last}][${oi}:v]overlay=0:0,format=yuv420p[v]`);
  const total=imgs.length*SLIDE-(imgs.length-1)*FADE;
  ff([...inputs,...(MUSIC?['-i',MUSIC]:[]),'-filter_complex',fc.join(';'),'-map','[v]',
    ...(MUSIC?['-map',`${oi+1}:a`,'-af',`afade=t=out:st=${total-1.5}:d=1.5`,'-c:a','aac']:[]),
    '-t',total.toFixed(2),'-c:v','libx264','-crf','20','-preset','medium','-movflags','+faststart',path.join(OUT,'reel_all.mp4')]);
  console.log('✓ reel_all.mp4',total.toFixed(1)+'s');
})();
