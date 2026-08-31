import type { FitnessActionSummary } from '../../shared/types'

export const muscleLabels = {
  chest: '胸部',
  upperBack: '上背',
  lats: '背阔肌',
  shoulders: '肩部',
  biceps: '肱二头肌',
  triceps: '肱三头肌',
  forearms: '前臂',
  abs: '腹部',
  obliques: '侧腹',
  lowerBack: '下背',
  glutes: '臀部',
  quads: '股四头肌',
  hamstrings: '腘绳肌',
  adductors: '内收肌',
  calves: '小腿',
} as const

export type MuscleGroup = keyof typeof muscleLabels
export type MuscleIntensity = Record<MuscleGroup, number>

type MuscleWeights = Partial<Record<MuscleGroup, number>>
type MuscleRule = { pattern: RegExp; weights: MuscleWeights }

const muscleGroups = Object.keys(muscleLabels) as MuscleGroup[]

const actionRules: MuscleRule[] = [
  { pattern: /深蹲|腿举|squat|leg press/i, weights: { quads: 1, glutes: .72, hamstrings: .32, adductors: .28 } },
  { pattern: /腿屈伸|leg extension/i, weights: { quads: 1 } },
  { pattern: /腿弯举|leg curl/i, weights: { hamstrings: 1 } },
  { pattern: /髋内收|内收机|adductor/i, weights: { adductors: 1 } },
  { pattern: /髋外展|外展机|abductor/i, weights: { glutes: 1 } },
  { pattern: /臀推|臀桥|hip thrust|glute bridge/i, weights: { glutes: 1, hamstrings: .35 } },
  { pattern: /硬拉|deadlift/i, weights: { hamstrings: .9, glutes: .82, lowerBack: .62, upperBack: .25 } },
  { pattern: /提踵|calf raise/i, weights: { calves: 1 } },
  { pattern: /悬吊抬腿|举腿|卷腹|仰卧起坐|crunch|sit.?up|leg raise/i, weights: { abs: 1, obliques: .18 } },
  { pattern: /侧屈|侧腹|俄罗斯转体|woodchop|russian twist/i, weights: { obliques: 1, abs: .38 } },
  { pattern: /卧推|推胸|夹胸|飞鸟|俯卧撑|双杠臂屈伸|bench press|chest press|chest fly|push.?up|dip/i, weights: { chest: 1, triceps: .48, shoulders: .3 } },
  { pattern: /肩推|推举|侧平举|前平举|upright row|shoulder press|overhead press|lateral raise|front raise/i, weights: { shoulders: 1, triceps: .22 } },
  { pattern: /反向飞鸟|面拉|rear delt|face pull/i, weights: { shoulders: .88, upperBack: .72 } },
  { pattern: /引体|下拉|高位下拉|pull.?up|chin.?up|lat pulldown/i, weights: { lats: 1, biceps: .56, forearms: .2 } },
  { pattern: /划船|row/i, weights: { upperBack: 1, lats: .72, biceps: .52, shoulders: .22 } },
  { pattern: /背伸|山羊挺身|hyperextension|back extension/i, weights: { lowerBack: 1, glutes: .35, hamstrings: .3 } },
  { pattern: /弯举|curl/i, weights: { biceps: 1, forearms: .25 } },
  { pattern: /臂屈伸|下压|颈后臂屈伸|skull crusher|triceps|pushdown/i, weights: { triceps: 1 } },
  { pattern: /腕弯举|握力|wrist curl|grip/i, weights: { forearms: 1 } },
]

const planRules: MuscleRule[] = [
  { pattern: /胸/, weights: { chest: 1, triceps: .42, shoulders: .25 } },
  { pattern: /背/, weights: { upperBack: .8, lats: 1, biceps: .42 } },
  { pattern: /肩/, weights: { shoulders: 1, triceps: .25 } },
  { pattern: /腿|臀/, weights: { quads: .8, glutes: .8, hamstrings: .65 } },
  { pattern: /腹|核心/, weights: { abs: 1, obliques: .45, lowerBack: .25 } },
  { pattern: /二头/, weights: { biceps: 1 } },
  { pattern: /三头/, weights: { triceps: 1 } },
]

function emptyIntensity(): MuscleIntensity {
  return Object.fromEntries(muscleGroups.map((group) => [group, 0])) as MuscleIntensity
}

function resolveWeights(action: FitnessActionSummary) {
  return actionRules.find((rule) => rule.pattern.test(action.actionName))?.weights
    || planRules.find((rule) => rule.pattern.test(action.planName))?.weights
    || {}
}

export function getLatestWorkout(actions: FitnessActionSummary[]) {
  if (!actions.length) return null
  const sorted = [...actions].sort((a, b) => b.date.localeCompare(a.date) || a.sequence - b.sequence)
  const latest = sorted[0]
  const workoutActions = sorted
    .filter((action) => action.date === latest.date && action.planName === latest.planName)
    .sort((a, b) => a.sequence - b.sequence)
  return {
    date: latest.date,
    planName: latest.planName,
    actions: workoutActions,
    sets: workoutActions.reduce((total, action) => total + action.sets, 0),
  }
}

export function getLatestMuscleLoad(actions: FitnessActionSummary[]) {
  const workout = getLatestWorkout(actions)
  const intensity = emptyIntensity()
  if (!workout) return { workout, intensity, activeMuscles: [] as Array<{ group: MuscleGroup; label: string; intensity: number }> }

  for (const action of workout.actions) {
    const weights = resolveWeights(action)
    for (const [group, weight] of Object.entries(weights) as Array<[MuscleGroup, number]>) {
      intensity[group] += action.sets * weight
    }
  }

  const peak = Math.max(...Object.values(intensity), 1)
  for (const group of muscleGroups) {
    intensity[group] = intensity[group] ? Math.max(.24, intensity[group] / peak) : 0
  }

  const activeMuscles = muscleGroups
    .filter((group) => intensity[group] > 0)
    .sort((a, b) => intensity[b] - intensity[a])
    .map((group) => ({ group, label: muscleLabels[group], intensity: intensity[group] }))

  return { workout, intensity, activeMuscles }
}
