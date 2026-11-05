/** Browser-generated RIFF PCM WAV. Encoder intentionally has no external dependencies. */
export type WavSpec={sampleRate:11025|22050|44100;channels:1|2;bitDepth:8|16};
export const WAV_PRESETS={
  effects:{sampleRate:22050,channels:1,bitDepth:16},
  voice:{sampleRate:11025,channels:1,bitDepth:8},
  ambient:{sampleRate:44100,channels:1,bitDepth:16},
  music:{sampleRate:44100,channels:2,bitDepth:16}
} as const satisfies Record<string,WavSpec>;

export function encodePcmWav(channels:Float32Array[],spec:WavSpec,loopCue=false):ArrayBuffer{
  if(channels.length!==spec.channels||!channels.length||!channels.every(a=>a.length===channels[0].length))throw Error('Audio channel lengths do not match.');
  const {sampleRate,bitDepth}=spec;
  if(![11025,22050,44100].includes(sampleRate)||![8,16].includes(bitDepth))throw Error('Unsupported PCM preset.');
  const frames=channels[0].length,bytesPerSample=bitDepth/8,dataLength=frames*spec.channels*bytesPerSample;
  if(!frames||dataLength>36*1024*1024)throw Error('Converted audio is too long (max 36 MiB WAV data).');
  // RIFF chunks are word-aligned. 8-bit mono PCM can have an odd data length.
  const dataPadding=dataLength%2;
  const extra=loopCue?36:0;
  const buffer=new ArrayBuffer(44+dataLength+dataPadding+extra),view=new DataView(buffer);
  const text=(offset:number,word:string)=>{for(let i=0;i<word.length;i++)view.setUint8(offset+i,word.charCodeAt(i))};
  text(0,'RIFF');view.setUint32(4,36+dataLength+dataPadding+extra,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,spec.channels,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*spec.channels*bytesPerSample,true);
  view.setUint16(32,spec.channels*bytesPerSample,true);view.setUint16(34,bitDepth,true);
  text(36,'data');view.setUint32(40,dataLength,true);
  let offset=44;
  for(let i=0;i<frames;i++)for(let c=0;c<spec.channels;c++){
    const sample=Math.min(1,Math.max(-1,channels[c][i]||0));
    if(bitDepth===16){view.setInt16(offset,sample<0?Math.round(sample*32768):Math.round(sample*32767),true);offset+=2}
    else {view.setUint8(offset,Math.max(0,Math.min(255,Math.round((sample+1)*127.5))));offset++}
  }
  if(dataPadding)view.setUint8(44+dataLength,0);
  if(loopCue){const at=44+dataLength+dataPadding;text(at,'cue ');view.setUint32(at+4,28,true);view.setUint32(at+8,1,true);view.setUint32(at+12,1,true);view.setUint32(at+16,0,true);text(at+20,'data');view.setUint32(at+24,0,true);view.setUint32(at+28,0,true);view.setUint32(at+32,0,true)}
  return buffer;
}

export async function convertAudioBuffer(file:File,spec:WavSpec,loopCue=false):Promise<ArrayBuffer>{
  if(file.size>32*1024*1024)throw Error('Input exceeds 32 MiB; trim the audio first.');
  const ctx=new AudioContext();let decoded:AudioBuffer;
  try{decoded=await ctx.decodeAudioData(await file.arrayBuffer())}
  finally{await ctx.close()}
  if(decoded.duration>600)throw Error('Input is over 10 minutes; split long tracks before conversion.');
  const outputFrames=Math.max(1,Math.ceil(decoded.duration*spec.sampleRate));
  const channels=spec.channels;
  const offline=new OfflineAudioContext(channels,outputFrames,spec.sampleRate);
  const source=offline.createBufferSource();source.buffer=decoded;
  // OfflineAudioContext handles resampling; a mono destination automatically
  // mixes stereo, and a stereo destination preserves stereo channels.
  source.connect(offline.destination);source.start(0);
  const rendered=await offline.startRendering();
  const samples=Array.from({length:channels},(_,i)=>rendered.getChannelData(i));
  return encodePcmWav(samples,spec,loopCue);
}

export function safeWavName(name:string):string{
  const base=name.replace(/\.[^.]+$/,'').normalize('NFKD').replace(/[^A-Za-z0-9_-]/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'').slice(0,65)||'custom_sound';
  return `${base}.wav`;
}
