"use client";

import { Component, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import RabbitController from './RabbitController.jsx';
import { ENTRANCE } from '../../../lib/museum-tour-state.js';

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Tour scene unavailable:', error); this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Beam({ position, size, color = '#593e32' }) {
  return <mesh position={position} receiveShadow castShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.8}/></mesh>;
}

function Interior({ hall }) {
  const length = Math.max(26, hall.artifacts.length * 4.2 + 18);
  const timber = hall.id === 'chonghua' ? '#643c32' : hall.id === 'cifu' ? '#657d67' : '#454e45';
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.04,10-length/2]} receiveShadow><planeGeometry args={[18,length+20]}/><meshStandardMaterial color="#718579" roughness={.48} metalness={.12}/></mesh>
    {[-1,1].map(side=><group key={side}>
      <Beam position={[side*7,3,4-length/2]} size={[.2,6,length]} color="#b5b59a"/>
      {Array.from({length:Math.ceil(length/5)},(_,i)=><group key={i} position={[0,0,7-i*5]}>
        <mesh position={[side*6,2.7,0]} castShadow><cylinderGeometry args={[.19,.25,5.4,12]}/><meshStandardMaterial color={timber}/></mesh>
        <Beam position={[0,5.3,0]} size={[12.4,.28,.32]} color={timber}/>
        <Beam position={[side*6.85,3,0]} size={[.08,3,2.8]} color="#d8d4b6"/>
        <Beam position={[side*6.78,3,0]} size={[.1,3,.06]} color={timber}/>
        <Beam position={[side*6.78,3,0]} size={[.1,.06,2.8]} color={timber}/>
      </group>)}
    </group>)}
    <Beam position={[0,3,7-length]} size={[14,6,.3]} color="#849483"/>
    {hall.artifacts.map(artifact=><group key={artifact.id} position={[artifact.waypoint[0]-1.7,0,artifact.waypoint[2]-1.5]}>
      <Beam position={[0,.5,0]} size={[1.5,1,1.3]} color="#334f44"/>
      <Beam position={[0,1.03,0]} size={[1.6,.06,1.4]} color="#c5ac70"/>
      <mesh position={[0,1.8,0]}><boxGeometry args={[1.5,1.5,1.3]}/><meshPhysicalMaterial color="#b8ded2" transparent opacity={.13} roughness={.12} depthWrite={false}/></mesh>
    </group>)}
  </group>;
}

export default function ExhibitionHallScene({ hall, state, onLanded, onReady, onUnavailable, reducedMotion, idlePaused }) {
  const [visible,setVisible]=useState(true);
  const [canvas,setCanvas]=useState(null);
  useEffect(()=>{
    const change=()=>setVisible(!document.hidden);
    document.addEventListener('visibilitychange',change);
    return ()=>document.removeEventListener('visibilitychange',change);
  },[]);
  useEffect(()=>{
    if(!canvas) return;
    const lost=event=>{event.preventDefault();onUnavailable();};
    canvas.addEventListener('webglcontextlost',lost);
    return ()=>canvas.removeEventListener('webglcontextlost',lost);
  },[canvas,onUnavailable]);
  return <SceneBoundary onUnavailable={onUnavailable}>
    <Canvas shadows dpr={[1,1.5]} camera={{position:[0,3.3,12],fov:43,near:.1,far:100}}
      frameloop={!visible?'never':state.phase==='moving'||(!reducedMotion&&!idlePaused)?'always':'demand'}
      onCreated={({gl})=>{setCanvas(gl.domElement);onReady();}}
      fallback={<span>3D is unavailable. The text tour will remain accessible.</span>}>
      <color attach="background" args={['#243b32']}/><fog attach="fog" args={['#74887a',14,46]}/>
      <ambientLight intensity={.8} color="#e7e8ce"/><hemisphereLight args={['#e8ead2','#334d3c',.7]}/>
      <directionalLight position={[3,9,8]} intensity={1.8} color="#fff0cc" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-20}/>
      <Interior hall={hall}/>
      <RabbitController state={state} artifacts={hall.artifacts} entrance={ENTRANCE} onLanded={onLanded} reducedMotion={reducedMotion} idlePaused={idlePaused}/>
    </Canvas>
  </SceneBoundary>;
}
