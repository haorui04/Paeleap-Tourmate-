"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";

function Ellipsoid({ position, scale, color, ...props }) {
  return <mesh position={position} scale={scale} castShadow {...props}>
    <sphereGeometry args={[1,24,16]} /><meshStandardMaterial color={color} roughness={.72}/>
  </mesh>;
}

/** Procedural character: soft cheeks, articulated ears, celadon coat and gold seal. */
export function RabbitModel({ reducedMotion = false }) {
  const body=useRef(null),leftEar=useRef(null),rightEar=useRef(null),eyes=useRef(null),clock=useRef(0);
  useFrame((_,delta)=>{
    if(reducedMotion) return;
    clock.current+=Math.min(delta,.05);const t=clock.current;
    body.current.scale.y=1+Math.sin(t*1.65)*.016;
    leftEar.current.rotation.z=-.16+Math.sin(t*.85)*.045;
    rightEar.current.rotation.z=.18+Math.sin(t*.85+.8)*.055;
    eyes.current.scale.y=Math.sin(t*.72)>.994 ? .12 : 1;
  });
  return <group ref={body}>
    <Ellipsoid position={[0,.7,-.32]} scale={[.3,.3,.3]} color="#fffae9"/>
    <Ellipsoid position={[0,.76,0]} scale={[.55,.69,.42]} color="#91b09a"/>
    <Ellipsoid position={[0,.82,.31]} scale={[.34,.43,.14]} color="#f2e9d2"/>
    <Ellipsoid position={[-.32,.15,.19]} scale={[.28,.15,.38]} color="#fff5df"/>
    <Ellipsoid position={[.32,.15,.19]} scale={[.28,.15,.38]} color="#fff5df"/>
    <Ellipsoid position={[-.54,.82,.13]} scale={[.19,.33,.2]} color="#fff5df" rotation={[0,0,-.24]}/>
    <Ellipsoid position={[.54,.82,.13]} scale={[.19,.33,.2]} color="#fff5df" rotation={[0,0,.24]}/>
    <Ellipsoid position={[0,1.55,.03]} scale={[.68,.59,.53]} color="#fff5df"/>
    <group ref={leftEar} position={[-.3,1.97,0]} rotation={[0,0,-.16]}>
      <Ellipsoid position={[0,.49,0]} scale={[.19,.63,.16]} color="#fff5df"/>
      <Ellipsoid position={[0,.51,.135]} scale={[.105,.46,.035]} color="#dca79c"/>
    </group>
    <group ref={rightEar} position={[.3,1.97,0]} rotation={[.05,0,.18]}>
      <Ellipsoid position={[0,.49,0]} scale={[.19,.63,.16]} color="#fff5df"/>
      <Ellipsoid position={[0,.51,.135]} scale={[.105,.46,.035]} color="#dca79c"/>
    </group>
    <group ref={eyes} position={[0,1.64,.48]}>
      {[-1,1].map(side=><group key={side} position={[side*.255,0,0]}>
        <Ellipsoid scale={[.078,.105,.06]} color="#273a31"/>
        <Ellipsoid position={[-.018,.027,.051]} scale={[.024,.028,.014]} color="#ffffff"/>
      </group>)}
    </group>
    <Ellipsoid position={[-.42,1.43,.42]} scale={[.13,.068,.04]} color="#e4b2a0"/>
    <Ellipsoid position={[.42,1.43,.42]} scale={[.13,.068,.04]} color="#e4b2a0"/>
    <Ellipsoid position={[-.115,1.36,.5]} scale={[.16,.12,.08]} color="#fffbed"/>
    <Ellipsoid position={[.115,1.36,.5]} scale={[.16,.12,.08]} color="#fffbed"/>
    <Ellipsoid position={[0,1.43,.58]} scale={[.07,.045,.04]} color="#b97e75"/>
    <mesh position={[0,1.06,.438]} rotation={[Math.PI/2,0,0]} castShadow>
      <cylinderGeometry args={[.105,.105,.05,24]}/><meshStandardMaterial color="#d8b969" metalness={.55} roughness={.35}/>
    </mesh>
  </group>;
}

/** Reports landing exactly once; position updates remain inside the render loop. */
export default function RabbitController({ state, artifacts, entrance, onLanded, reducedMotion, idlePaused }) {
  const root=useRef(null),facing=useRef(null),progress=useRef(0),reported=useRef(null);
  const {camera,size}=useThree();
  const mobile=size.width<700;
  const from=state.currentArtifactIndex<0 ? entrance : artifacts[state.currentArtifactIndex].waypoint;
  const to=state.targetIndex===null ? from : artifacts[state.targetIndex].waypoint;
  const cameraTarget=useRef(new Vector3());
  const lookTarget=useRef(new Vector3());
  const initialized=useRef(false);
  useEffect(()=>{progress.current=0;reported.current=null;},[state.motionId]);
  useEffect(()=>{initialized.current=false;},[mobile]);

  useFrame((_,delta)=>{
    if(!root.current) return;
    const step=Math.min(delta,.05);
    const distance=Math.hypot(to[0]-from[0],to[2]-from[2]);
    const hops=Math.max(3,Math.min(6,Math.ceil(distance/1.6)));
    const duration=hops*.42;
    if(state.phase==="moving") progress.current=Math.min(1,progress.current+(reducedMotion?1:step/duration));
    const t=state.phase==="moving" ? progress.current : 0;
    const travel=t*t*(3-2*t);
    const x=MathUtils.lerp(from[0],to[0],travel),z=MathUtils.lerp(from[2],to[2],travel);
    root.current.position.set(x,reducedMotion?0:Math.abs(Math.sin(t*Math.PI*hops))*.46,z);
    const direction=state.phase==="moving"&&t<.9 ? Math.atan2(to[0]-from[0],to[2]-from[2]) : 0;
    facing.current.rotation.y=MathUtils.damp(facing.current.rotation.y,direction,8,step);
    const lookX=x+(mobile?.2:1.8),lookY=mobile?2.1:1.8;
    if(!initialized.current||reducedMotion){camera.position.set(x,3.3,z+(mobile?12:9));cameraTarget.current.set(lookX,lookY,z);initialized.current=true;}
    else {
      camera.position.x=MathUtils.damp(camera.position.x,x,4,step);
      camera.position.y=MathUtils.damp(camera.position.y,3.3,4,step);
      camera.position.z=MathUtils.damp(camera.position.z,z+(mobile?12:9),4,step);
      cameraTarget.current.lerp(lookTarget.current.set(lookX,lookY,z),1-Math.exp(-4*step));
    }
    camera.lookAt(cameraTarget.current);
    if(state.phase==="moving"&&t>=1&&reported.current!==state.motionId){reported.current=state.motionId;onLanded(state.motionId);}
  });

  return <group ref={root} position={from}>
    <group ref={facing}><RabbitModel reducedMotion={reducedMotion||idlePaused}/></group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><circleGeometry args={[.65,32]}/><meshBasicMaterial color="#162f24" transparent opacity={.12} depthWrite={false}/></mesh>
  </group>;
}
