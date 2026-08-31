import { Canvas, useFrame } from '@react-three/fiber'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Color, type Group } from 'three'
import type { FitnessActionSummary } from '../../shared/types'
import { getLatestMuscleLoad, type MuscleGroup, type MuscleIntensity } from '../lib/muscles'
import styles from './MuscleFigure.module.css'

type Vector3 = [number, number, number]
type AnatomyHandle = { reset: () => void; rotateBy: (delta: number) => void }

const cool = new Color('#4dbed2')
const hot = new Color('#ff765c')

function muscleColor(intensity: number) {
  if (!intensity) return '#353941'
  return cool.clone().lerp(hot, intensity).getStyle()
}

function BasePart({ position, rotation, scale, shape = 'capsule', args }: { position: Vector3; rotation?: Vector3; scale?: Vector3; shape?: 'capsule' | 'sphere' | 'box'; args: number[] }) {
  return <mesh castShadow receiveShadow position={position} rotation={rotation} scale={scale}>
    {shape === 'capsule' && <capsuleGeometry args={args as [number, number, number, number]} />}
    {shape === 'sphere' && <sphereGeometry args={args as [number, number, number]} />}
    {shape === 'box' && <boxGeometry args={args as [number, number, number]} />}
    <meshStandardMaterial color="#24272d" metalness={.08} roughness={.72} />
  </mesh>
}

function MusclePart({ group, intensity, position, rotation, scale, shape = 'capsule', args }: { group: MuscleGroup; intensity: MuscleIntensity; position: Vector3; rotation?: Vector3; scale?: Vector3; shape?: 'capsule' | 'sphere'; args: number[] }) {
  const load = intensity[group]
  const color = muscleColor(load)
  return <mesh castShadow position={position} rotation={rotation} scale={scale}>
    {shape === 'capsule' && <capsuleGeometry args={args as [number, number, number, number]} />}
    {shape === 'sphere' && <sphereGeometry args={args as [number, number, number]} />}
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={load ? .08 + load * .22 : 0} metalness={.04} roughness={.58} />
  </mesh>
}

const Anatomy = forwardRef<AnatomyHandle, { intensity: MuscleIntensity; dragging: boolean; autoRotate: boolean }>(function Anatomy({ intensity, dragging, autoRotate }, ref) {
  const model = useRef<Group>(null)
  const targetYaw = useRef(-.18)
  useImperativeHandle(ref, () => ({
    reset: () => { targetYaw.current = 0 },
    rotateBy: (delta) => { targetYaw.current += delta },
  }), [])
  useFrame((_, delta) => {
    if (!model.current) return
    if (autoRotate && !dragging) targetYaw.current += delta * .2
    model.current.rotation.y += (targetYaw.current - model.current.rotation.y) * Math.min(1, delta * 12)
  })
  return <group ref={model} position={[0, -.15, 0]}>
    <BasePart position={[0, 2.78, 0]} scale={[.87, 1.06, .82]} shape="sphere" args={[.38, 24, 18]} />
    <BasePart position={[0, 2.31, 0]} args={[.15, .22, 8, 16]} />
    <BasePart position={[0, 1.45, 0]} scale={[1, 1, .64]} args={[.61, 1.15, 12, 24]} />
    <BasePart position={[0, .43, 0]} scale={[1, .72, .76]} args={[.5, .38, 10, 20]} />
    <BasePart position={[-.88, 1.24, 0]} rotation={[0, 0, -.09]} args={[.21, 1.05, 8, 16]} />
    <BasePart position={[.88, 1.24, 0]} rotation={[0, 0, .09]} args={[.21, 1.05, 8, 16]} />
    <BasePart position={[-1, .24, 0]} rotation={[0, 0, -.04]} args={[.17, .82, 8, 16]} />
    <BasePart position={[1, .24, 0]} rotation={[0, 0, .04]} args={[.17, .82, 8, 16]} />
    <BasePart position={[-1.03, -.34, 0]} args={[.13, .2, 8, 14]} />
    <BasePart position={[1.03, -.34, 0]} args={[.13, .2, 8, 14]} />
    <BasePart position={[-.3, -.56, 0]} rotation={[0, 0, -.02]} args={[.29, 1.15, 10, 20]} />
    <BasePart position={[.3, -.56, 0]} rotation={[0, 0, .02]} args={[.29, 1.15, 10, 20]} />
    <BasePart position={[-.3, -1.75, 0]} args={[.22, .92, 10, 18]} />
    <BasePart position={[.3, -1.75, 0]} args={[.22, .92, 10, 18]} />
    <BasePart position={[-.3, -2.35, .16]} scale={[1, .55, 1.75]} shape="box" args={[.36, .26, .42]} />
    <BasePart position={[.3, -2.35, .16]} scale={[1, .55, 1.75]} shape="box" args={[.36, .26, .42]} />

    <MusclePart group="chest" intensity={intensity} position={[-.27, 1.82, .41]} scale={[1.15, .9, .52]} shape="sphere" args={[.29, 20, 14]} />
    <MusclePart group="chest" intensity={intensity} position={[.27, 1.82, .41]} scale={[1.15, .9, .52]} shape="sphere" args={[.29, 20, 14]} />
    {[1.48, 1.2, .92].flatMap((y) => [-.13, .13].map((x) => <MusclePart key={`${x}-${y}`} group="abs" intensity={intensity} position={[x, y, .43]} scale={[.7, .82, .38]} shape="sphere" args={[.17, 16, 12]} />))}
    <MusclePart group="obliques" intensity={intensity} position={[-.43, 1.14, .27]} rotation={[0, 0, -.08]} scale={[.8, 1, .52]} args={[.15, .55, 8, 14]} />
    <MusclePart group="obliques" intensity={intensity} position={[.43, 1.14, .27]} rotation={[0, 0, .08]} scale={[.8, 1, .52]} args={[.15, .55, 8, 14]} />
    <MusclePart group="shoulders" intensity={intensity} position={[-.69, 1.82, 0]} scale={[1.05, .9, .9]} shape="sphere" args={[.28, 18, 14]} />
    <MusclePart group="shoulders" intensity={intensity} position={[.69, 1.82, 0]} scale={[1.05, .9, .9]} shape="sphere" args={[.28, 18, 14]} />
    <MusclePart group="biceps" intensity={intensity} position={[-.88, 1.22, .17]} rotation={[0, 0, -.09]} args={[.14, .52, 8, 14]} />
    <MusclePart group="biceps" intensity={intensity} position={[.88, 1.22, .17]} rotation={[0, 0, .09]} args={[.14, .52, 8, 14]} />
    <MusclePart group="triceps" intensity={intensity} position={[-.88, 1.2, -.17]} rotation={[0, 0, -.09]} args={[.14, .56, 8, 14]} />
    <MusclePart group="triceps" intensity={intensity} position={[.88, 1.2, -.17]} rotation={[0, 0, .09]} args={[.14, .56, 8, 14]} />
    <MusclePart group="forearms" intensity={intensity} position={[-1, .24, 0]} rotation={[0, 0, -.04]} args={[.13, .63, 8, 14]} />
    <MusclePart group="forearms" intensity={intensity} position={[1, .24, 0]} rotation={[0, 0, .04]} args={[.13, .63, 8, 14]} />
    <MusclePart group="upperBack" intensity={intensity} position={[-.27, 1.7, -.4]} scale={[1.15, 1, .48]} shape="sphere" args={[.3, 18, 14]} />
    <MusclePart group="upperBack" intensity={intensity} position={[.27, 1.7, -.4]} scale={[1.15, 1, .48]} shape="sphere" args={[.3, 18, 14]} />
    <MusclePart group="lats" intensity={intensity} position={[-.43, 1.22, -.29]} rotation={[0, 0, -.08]} scale={[.88, 1.08, .52]} args={[.17, .58, 8, 14]} />
    <MusclePart group="lats" intensity={intensity} position={[.43, 1.22, -.29]} rotation={[0, 0, .08]} scale={[.88, 1.08, .52]} args={[.17, .58, 8, 14]} />
    <MusclePart group="lowerBack" intensity={intensity} position={[0, .77, -.4]} scale={[1.5, 1, .5]} args={[.14, .38, 8, 14]} />
    <MusclePart group="glutes" intensity={intensity} position={[-.27, .35, -.39]} scale={[1, .85, .62]} shape="sphere" args={[.3, 18, 14]} />
    <MusclePart group="glutes" intensity={intensity} position={[.27, .35, -.39]} scale={[1, .85, .62]} shape="sphere" args={[.3, 18, 14]} />
    <MusclePart group="quads" intensity={intensity} position={[-.3, -.58, .2]} args={[.22, .76, 8, 16]} />
    <MusclePart group="quads" intensity={intensity} position={[.3, -.58, .2]} args={[.22, .76, 8, 16]} />
    <MusclePart group="hamstrings" intensity={intensity} position={[-.3, -.58, -.2]} args={[.21, .78, 8, 16]} />
    <MusclePart group="hamstrings" intensity={intensity} position={[.3, -.58, -.2]} args={[.21, .78, 8, 16]} />
    <MusclePart group="adductors" intensity={intensity} position={[-.13, -.58, .08]} scale={[.72, 1, .7]} args={[.14, .68, 8, 14]} />
    <MusclePart group="adductors" intensity={intensity} position={[.13, -.58, .08]} scale={[.72, 1, .7]} args={[.14, .68, 8, 14]} />
    <MusclePart group="calves" intensity={intensity} position={[-.3, -1.76, -.08]} args={[.16, .66, 8, 14]} />
    <MusclePart group="calves" intensity={intensity} position={[.3, -1.76, -.08]} args={[.16, .66, 8, 14]} />
  </group>
})

function formatDate(value: string) {
  const compact = value.replace(/\D/g, '').slice(0, 8)
  return compact.length === 8 ? `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6)}` : value
}

export function MuscleFigure({ actions }: { actions: FitnessActionSummary[] }) {
  const { workout, intensity, activeMuscles } = useMemo(() => getLatestMuscleLoad(actions), [actions])
  const [autoRotate, setAutoRotate] = useState(true)
  const [dragging, setDragging] = useState(false)
  const previousX = useRef(0)
  const anatomy = useRef<AnatomyHandle>(null)

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    setDragging(true)
    previousX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    anatomy.current?.rotateBy((event.clientX - previousX.current) * .012)
    previousX.current = event.clientX
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <aside className={styles.figure} aria-label="最新训练肌群三维视图">
    <div className={styles.figureHeader}>
      <span>muscle.load / latest</span>
      <div className={styles.controls}>
        <button type="button" title={autoRotate ? '暂停旋转' : '继续旋转'} aria-label={autoRotate ? '暂停人体模型旋转' : '继续人体模型旋转'} onClick={() => setAutoRotate((value) => !value)}>{autoRotate ? <Pause size={13} /> : <Play size={13} />}</button>
        <button type="button" title="回到正面" aria-label="将人体模型转回正面" onClick={() => anatomy.current?.reset()}><RotateCcw size={13} /></button>
      </div>
    </div>
    <div className={styles.viewport} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
      <Canvas aria-label="可旋转的训练肌群人体模型" camera={{ position: [0, .25, 9.4], fov: 34 }} dpr={[1, 1.6]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} shadows>
        <ambientLight intensity={1.05} />
        <directionalLight castShadow intensity={2.1} position={[3.5, 5, 5]} shadow-mapSize-height={512} shadow-mapSize-width={512} />
        <directionalLight color="#68c4d5" intensity={1.05} position={[-4, 1, 3]} />
        <pointLight color="#ff8068" intensity={1.2} position={[2, -1, -3]} />
        <Anatomy ref={anatomy} intensity={intensity} dragging={dragging} autoRotate={autoRotate} />
        <mesh receiveShadow position={[0, -2.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.1, 48]} />
          <shadowMaterial opacity={.18} />
        </mesh>
      </Canvas>
      <span className={styles.axis}>FRONT / BACK</span>
    </div>
    {workout ? <div className={styles.workoutMeta}>
      <strong>{workout.planName}</strong>
      <span>{formatDate(workout.date)} / {workout.actions.length} actions / {workout.sets} sets</span>
      <div className={styles.legend} aria-label="训练肌群负荷">
        {activeMuscles.slice(0, 6).map((muscle) => <span key={muscle.group}><i style={{ '--muscle-color': muscleColor(muscle.intensity) } as CSSProperties} />{muscle.label}</span>)}
      </div>
    </div> : <p className={styles.empty}>no muscle load data</p>}
  </aside>
}
