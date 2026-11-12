import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Peer} from '../server/buildTogether.js';

/** Simulates a Porthole/WebSocket recipient with temporarily blocked TCP
 * writes, not just a LAN socket that always drains immediately. */
class SlowSocket extends EventEmitter {
  writable=true;
  writableNeedDrain=false;
  writableLength=0;
  sent=[];
  ended=false;
  destroyed=false;
  write(frame){
    assert.ok(this.writable);
    this.sent.push(frame);
    this.writableLength+=frame.length;
    if(this.writableLength>128*1024){this.writableNeedDrain=true;return false;}
    return true;
  }
  drainNow(){this.writableLength=0;this.writableNeedDrain=false;this.emit('drain');}
  end(){this.ended=true;}
  destroy(){this.destroyed=true;this.writable=false;this.emit('close');}
}
function decodeServerFrame(frame){
 assert.equal(frame[0]&15,1);
 const type=frame[1]&127;
 const offset=type===127?10:type===126?4:2;
 const length=type===127?Number(frame.readBigUInt64BE(2)):type===126?frame.readUInt16BE(2):type;
 return JSON.parse(frame.subarray(offset,offset+length).toString('utf8'));
}

test('slow terrain receiver queues multi-megabyte reliable broadcasts without being disconnected; edits stay ordered',()=>{
 const socket=new SlowSocket();let closed=0;
 const peer=new Peer(socket,()=>{},()=>closed++);
 const chunk='x'.repeat(560*1024);
 for(let i=0;i<16;i++)peer.send({type:'change',revision:i+1,ops:[{kind:'put',id:`terrain-${i}`,object:{data:chunk}}]});
 assert.equal(peer.closed,false,'backpressure should not close a reachable peer');
 assert.equal(closed,0);
 assert.ok(peer.queuedBytes>4*1024*1024,'test must exceed the legacy forced-close threshold');
 assert.ok(peer.reliableQueue.length>0);
 // Presence must not cut ahead of the queued geometry.
 peer.send({type:'camera',pose:{position:[0,0,0]}});
 assert.equal(socket.sent.filter(frame=>decodeServerFrame(frame).type==='camera').length,0);
 let loops=0;
 while(peer.reliableQueue.length&&loops++<40)socket.drainNow();
 assert.equal(peer.queuedBytes,0);
 assert.equal(peer.closed,false);
 const frames=socket.sent.map(decodeServerFrame);
 assert.equal(frames.length,16);
 assert.deepEqual(frames.map(msg=>msg.revision),Array.from({length:16},(_,i)=>i+1),'client must receive geometry in revision order');
 socket.drainNow();
 peer.send({type:'camera',pose:{position:[1,0,0]}});
 assert.equal(socket.sent.length,17,'presence resumes after reliable queue drains');
 peer.close();
 assert.equal(closed,1);
});

test('queue has a finite memory cap for a peer that stops reading',()=>{
 const socket=new SlowSocket();const peer=new Peer(socket,()=>{},()=>{});
 const block='z'.repeat(2*1024*1024);
 let attempts=0;
 while(!peer.closed&&attempts<40){peer.send({type:'change',revision:attempts+1,ops:[{kind:'put',id:'x',object:{block}}]});attempts++;}
 assert.ok(attempts>=16&&attempts<40,'must tolerate an ordinary terrain burst yet limit permanent stalls');
 assert.equal(peer.closed,true,'abandoned peers must not exhaust server memory');
 assert.equal(socket.destroyed,true);
});
