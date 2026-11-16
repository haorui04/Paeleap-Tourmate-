"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MathUtils, DoubleSide, PCFSoftShadowMap } from "three";
import styles from "./MuseumBackgroundScene.module.css";

const C = { mist: "#173a31", roof: "#3a5a4f", wall: "#bbad8a", timber: "#805541", stone: "#6d8071", gold: "#bba16c" };
const TREES = [[-12,-9],[-11,-6],[-12,6],[-11,9],[12,-9],[13,-5],[12,7],[10,10],[-6,11],[5,11],[-13,0],[13,1]];

function Block({ position, scale, color, ...props }) {
  return <mesh position={position} scale={scale} receiveShadow castShadow {...props}>
    <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={color} roughness={0.82} />
  </mesh>;
}

// Three rectangular rings create a broad, gently flared hip roof with a long ridge.
function Roof({ width, depth, y }) {
  const vertices = useMemo(() => {
    const rings = [[width / 2, depth / 2, 0.1], [width * 0.43, depth * 0.4, 0.22], [width * 0.28, 0.06, 1.12]];
    const corners = rings.map(([x, z, h]) => [[-x,h,-z],[x,h,-z],[x,h,z],[-x,h,z]]);
    const out = [];
    for (let level=0; level<2; level++) for (let side=0; side<4; side++) {
      const next=(side+1)%4;
      for (const point of [corners[level][side],corners[level+1][side],corners[level][next],corners[level][next],corners[level+1][side],corners[level+1][next]]) out.push(...point);
    }
    return new Float32Array(out);
  }, [width, depth]);
  return <group position={[0,y,0]}>
    <mesh castShadow receiveShadow>
      <bufferGeometry onUpdate={geometry => geometry.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[vertices,3]} />
      </bufferGeometry>
      <meshStandardMaterial color={C.roof} roughness={0.55} metalness={0.12} side={DoubleSide} />
    </mesh>
    <Block position={[0,1.14,0]} scale={[width*.62,.1,.15]} color={C.gold}/>
    {[-1,1].map(side => <Block key={side} position={[0,.08,side*depth/2]} scale={[width,.09,.09]} color={C.gold}/>)}
  </group>;
}

function Pavilion({ position, width=6, depth=4, height=2.5, grand=false, rotation=0 }) {
  return <group position={position} rotation={[0,rotation,0]}>
    <Block position={[0,.18,0]} scale={[width+1,.36,depth+1]} color={C.stone}/>
    <Block position={[0,height/2+.35,0]} scale={[width*.85,height,depth*.76]} color={C.wall}/>
    <Block position={[0,height*.48+.35,depth*.39]} scale={[width*.69,height*.78,.05]} color="#244037"/>
    {[-.4,-.2,0,.2,.4].map(x => <group key={x}>
      <Block position={[x*width,height/2+.35,depth*.46]} scale={[.14,height,.14]} color={C.timber}/>
      <Block position={[x*width,height/2+.35,-depth*.46]} scale={[.14,height,.14]} color={C.timber}/>
    </group>)}
    <Block position={[0,height+.22,depth*.45]} scale={[width,.16,.15]} color={C.timber}/>
    <Roof width={width+1.5} depth={depth+1.5} y={height+.35}/>
    {grand && <>
      <Block position={[0,height+1.5,0]} scale={[width*.63,.7,depth*.65]} color={C.wall}/>
      <Roof width={width*.85} depth={depth*.9} y={height+1.8}/>
    </>}
    {[0,1,2].map(n => <Block key={n} position={[0,.06+n*.09,depth/2+.8-n*.25]} scale={[width*.36,.12,.8]} color="#a2aa91"/>)}
  </group>;
}

function GardenTree({ x, z, index }) {
  const s=.8+(index%3)*.2;
  return <group position={[x,0,z]} scale={s}>
    <mesh position={[0,.9,0]} castShadow><cylinderGeometry args={[.09,.15,1.8,6]}/><meshStandardMaterial color="#655840"/></mesh>
    <mesh position={[0,2,0]} scale={[1.1,.8,1]} castShadow><icosahedronGeometry args={[1.15,1]}/><meshStandardMaterial color={index%3 ? "#54735a" : "#839273"} roughness={1}/></mesh>
    <mesh position={[.6,1.5,.25]} scale={[1,.55,.7]} castShadow><icosahedronGeometry args={[.9,0]}/><meshStandardMaterial color="#53735e" roughness={1}/></mesh>
  </group>;
}

function PalaceComplex() {
  return <group>
    <Block position={[0,-.45,0]} scale={[31,.8,27]} color="#3b5949"/>
    <Block position={[0,-.02,0]} scale={[24,.12,22]} color="#758370"/>
    <Block position={[0,.06,2]} scale={[3,.06,20]} color="#b2b49a"/>
    <Block position={[0,.07,2]} scale={[22,.05,2]} color="#9da78e"/>
    <Block position={[0,.1,-1]} scale={[11,.08,8]} color="#929e87"/>
    <Pavilion position={[0,0,-6]} width={9} depth={5} height={3} grand/>
    <Pavilion position={[-8,0,-3]} width={7} depth={3} rotation={Math.PI/2}/>
    <Pavilion position={[8,0,-3]} width={7} depth={3} rotation={Math.PI/2}/>
    <Pavilion position={[0,0,9]} width={7} depth={3} height={2}/>
    <Pavilion position={[8,0,6]} width={4} depth={3} height={1.8}/>
    <Block position={[-7,.06,6]} scale={[7,.16,5]} color="#a5a78b"/>
    <mesh position={[-7,.16,6]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[6.7,4.7]}/><meshStandardMaterial color="#527f74" roughness={.18} metalness={.4}/>
    </mesh>
    <Block position={[-7,.26,6]} scale={[1,.28,5.4]} color="#b6aa87"/>
    {[-12,12].map(x => <Block key={x} position={[x,.65,0]} scale={[.3,1.3,22]} color="#929e83"/>)}
    <Block position={[0,.65,-11]} scale={[24,1.3,.3]} color="#929e83"/>
    {[-8,8].map(x => <Block key={x} position={[x,.65,11]} scale={[8,1.3,.3]} color="#929e83"/>)}
    {TREES.map(([x,z],index)=><GardenTree key={index} x={x} z={z} index={index}/>)}
    {[[-10,7],[-4,8],[11,4]].map(([x,z],i)=><mesh key={i} position={[x,.35,z]} scale={[.7,.55,1]} castShadow><dodecahedronGeometry args={[.8,0]}/><meshStandardMaterial color="#82917d" roughness={1}/></mesh>)}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.87,0]} receiveShadow><planeGeometry args={[180,180]}/><meshStandardMaterial color="#234537" roughness={1}/></mesh>
  </group>;
}

function CameraRig({ moving }) {
  const { camera, size, scene } = useThree();
  const time = useRef(0);
  const pointer = useRef({x:0,y:0});
  const radius = 45 / Math.min(size.width/size.height, 1.35);
  const targetX = size.width > size.height ? -5 : 0;
  useEffect(() => {
    camera.position.set(Math.sin(.55)*radius,radius*.78,Math.cos(.55)*radius);
    camera.lookAt(targetX,0,0);
    // Match atmospheric depth to the responsive camera distance on narrow screens.
    if (scene.fog) { scene.fog.near=radius*.9; scene.fog.far=radius*3.3; }
  }, [camera,radius,targetX,scene]);
  useEffect(() => {
    if (!moving) return;
    const move = e => { if(e.pointerType === "mouse") pointer.current={x:e.clientX/window.innerWidth*2-1,y:e.clientY/window.innerHeight*2-1}; };
    const reset = () => { pointer.current={x:0,y:0}; };
    window.addEventListener("pointermove",move,{passive:true}); window.addEventListener("blur",reset);
    return () => { window.removeEventListener("pointermove",move); window.removeEventListener("blur",reset); };
  },[moving]);
  useFrame((_,delta) => {
    if (!moving) return;
    const step=Math.min(delta,.05); time.current+=step;
    const angle=.55+time.current*.018+pointer.current.x*.055;
    camera.position.x=MathUtils.damp(camera.position.x,Math.sin(angle)*radius,1.5,step);
    camera.position.z=MathUtils.damp(camera.position.z,Math.cos(angle)*radius,1.5,step);
    camera.position.y=MathUtils.damp(camera.position.y,radius*(.78+pointer.current.y*.025),1.5,step);
    camera.lookAt(targetX,0,0);
  });
  return null;
}

function PalaceFallback() {
  return <div className={styles.fallback}><svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="M100 500 520 260 950 490 530 690Z" fill="#456452"/>
    <path d="M220 470 520 300 820 470 520 650Z" fill="#7b8d75"/>
    {[[510,290,1.3],[310,410,.8],[710,410,.8],[510,540,.8]].map(([x,y,s],i)=><g key={i} transform={`translate(${x} ${y}) scale(${s})`}><path d="M-95 0H95V75H-95Z" fill="#a3997b"/><path d="M-125 0Q-70-15 0-70 70-15 125 0L0 18Z" fill="#233f35" stroke="#bba16c" strokeWidth="2"/><path d="M-65 20V70M-20 20V70M20 20V70M65 20V70" stroke="#70533d" strokeWidth="9"/></g>)}
  </svg></div>;
}

class WebGLBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <PalaceFallback/> : this.props.children;}
}

export default function MuseumBackgroundScene({ paused=false, reducedMotion=false }) {
  const [mounted,setMounted]=useState(false);
  const [visible,setVisible]=useState(true);
  const [lost,setLost]=useState(false);
  const host=useRef(null);
  useEffect(()=>{
    setMounted(true);
    const update=()=>setVisible(!document.hidden); update();
    const node=host.current;
    const contextLost=e=>{e.preventDefault();setLost(true);};
    document.addEventListener("visibilitychange",update);
    node.addEventListener("webglcontextlost",contextLost,true);
    return ()=>{document.removeEventListener("visibilitychange",update);node.removeEventListener("webglcontextlost",contextLost,true);};
  },[]);
  const moving=!paused&&!reducedMotion&&visible;
  return <div ref={host} className={styles.background} aria-hidden="true" data-museum-scene>
    <PalaceFallback/>
    {mounted&&!lost&&<WebGLBoundary><Canvas
      shadows={{type:PCFSoftShadowMap}} dpr={[1,1.5]} camera={{position:[20,26,32],fov:46,near:.1,far:220}}
      frameloop={!visible ? "never" : moving ? "always" : "demand"}
      gl={{antialias:true,alpha:false,powerPreference:"low-power"}}
      fallback={<PalaceFallback/>}>
      <color attach="background" args={[C.mist]}/><fog attach="fog" args={[C.mist,45,135]}/>
      <ambientLight intensity={.75} color="#e4eedc"/>
      <hemisphereLight args={["#dcead7","#233c2d",1.1]}/>
      <directionalLight position={[12,24,8]} color="#ffe8b8" intensity={2.5} castShadow
        shadow-mapSize={[1024,1024]} shadow-camera-left={-24} shadow-camera-right={24}
        shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-far={80} shadow-normalBias={.08}/>
      <CameraRig moving={moving}/><PalaceComplex/>
    </Canvas></WebGLBoundary>}
    <div className={styles.shade}/>
  </div>;
}
