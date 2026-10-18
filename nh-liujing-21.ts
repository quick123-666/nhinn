// nh-liujing-21.ts — 六经辨证网络 v6：21 维 × 6 经，真实医案混合训练
//   维度：仲景提纲 10 维 + 倪师临证扩展 11 维（便秘/呕/咽干目眩/胸胁苦满/腹痛/失眠/小便清长/脉浮/脉大/脉微细/舌苔黄燥）
//   数据：nh-all-dataset.json（319 条：1257 表指纹/方名映射 + 03_yian 医案集字段标签）
//   训练：trainSoftmax（权重全 0 初始化，类别加权平衡 + labelSmoothing 抗噪声）
//   验证：①提纲 6 案 ②训练集分经准确率 ③学出权重 vs 仲景提纲
import {createSourceTable, input} from './src/runtime/cells.ts'
import {trainSoftmax, type TrainableParam} from './trainable.ts'
import {readFileSync, writeFileSync} from 'node:fs'

const table = createSourceTable()
const SYMPTOMS = [
  'wuhan', 'fare', 'hanchu', 'kouke', 'kouku', 'wanglai', 'fuman', 'xiali', 'jueleng', 'danwumei',
  'bianmi', 'ou', 'yanmu', 'xiongxie', 'futong', 'shimian', 'xiaobian', 'maifu', 'maida', 'maiwei', 'shehuang',
  'maixuan', 'maichen', 'maichi', 'maijin', 'maishuo', 'toutong', 'shentong', 'weikou', 'kesou', 'shuizhong', 'yuejing', 'xinggong',
] as const
const SYMPTOM_NAMES = ['恶寒','发热','汗出','口渴','口苦','往来','腹满','下利','厥冷','但欲寐','便秘','呕','咽干目眩','胸胁苦满','腹痛','失眠','小便清长','脉浮','脉大','脉微细','舌苔黄燥','脉弦','脉沉','脉迟','脉紧','脉数','头痛','身痛','胃口','咳嗽','水肿','月经','性功能']
const CHANNELS = ['taiyang', 'yangming', 'shaoyang', 'taiyin', 'shaoyin', 'jueyin'] as const
const CHANNEL_ZH = ['太阳', '阳明', '少阳', '太阴', '少阴', '厥阴'] as const
const CHANNEL_NAMES: Record<string, string> = {
  taiyang: '太阳·桂枝汤/麻黄汤', yangming: '阳明·白虎汤/承气汤', shaoyang: '少阳·小柴胡汤',
  taiyin: '太阴·理中汤', shaoyin: '少阴·四逆汤', jueyin: '厥阴·乌梅丸',
}

// 26 症状 + 156 权重 + 6 阈值，全部显式 declare
const decl: Record<string, unknown> = {}
for (const s of SYMPTOMS) decl[s] = input([0, 100])
for (let i = 0; i < CHANNELS.length * SYMPTOMS.length; i++) decl['w' + i] = input([-1.5, 1.5])
for (let i = 0; i < CHANNELS.length; i++) decl['t' + i] = input([0, 150])
const cells = table.declare(decl as Record<string, ReturnType<typeof input>>)
const cir = table.createCircuit()
const W = (k: number, j: number) => cells['w' + (k * SYMPTOMS.length + j)]!
const T = (k: number) => cells['t' + k]!

const logits: number[] = []
for (let k = 0; k < CHANNELS.length; k++) {
  const mulTerms: [number, number][] = []
  for (let j = 0; j < SYMPTOMS.length; j++) mulTerms.push([cir.multiply(W(k, j), cells[SYMPTOMS[j]]!), 1])
  mulTerms.push([T(k), -1])
  logits.push(cir.affine(mulTerms))
}

const {validate, circuit: net, initialSource} = {
  output: Object.fromEntries(CHANNELS.map((c, i) => ['score' + c, logits[i]!])),
  ...table.finish(),
}
const source = new Float32Array(initialSource)
const inputCells = SYMPTOMS.map(s => cells[s]!)
const params: TrainableParam[] = []
for (let k = 0; k < CHANNELS.length; k++) {
  for (let j = 0; j < SYMPTOMS.length; j++) params.push({wire: W(k, j), min: -1.5, max: 1.5})
  params.push({wire: T(k), min: 0, max: 150})
}

// —— 加载真实医案数据集（21 维 features + 六经 labelName）——
// 源1: nh-all-dataset.json（326 条医案：1257 表指纹/方名映射 + 03_yian 医案集）
// 源2: nh-hints-dataset.json（224 条经方方证：nihaixia-app formulas.json meridian 字段）
const raw = JSON.parse(readFileSync('nh-all-dataset.json', 'utf8')) as {
  dataset: {title: string, features: number[], labelName: string, via: string}[]
}
// 评测集留出：训练时剔除 holdout 样本（保证评测集模型未见过）
const evalSet = JSON.parse(readFileSync('nh-eval-dataset.json', 'utf8')) as {holdoutTitles: string[]}
const evalTitles = new Set(evalSet.holdoutTitles ?? [])
// 源2: nh-hints-dataset.json（经方方证）——仅取可信标签（meridian单经 + 口语方证），复合取主有口径噪声弃用
const rawHints = JSON.parse(readFileSync('nh-hints-dataset.json', 'utf8')) as {
  dataset: {features: number[], labelName: string, via: string}[]
}
// 源3: nh-rules-dataset.json（89 条问诊规则：nihaixia-app formula_rules.dart，特征密度最高 4.7 维）
const rawRules = JSON.parse(readFileSync('nh-rules-dataset.json', 'utf8')) as {
  dataset: {features: number[], labelName: string, via: string}[]
}
// 精选太阴/少阳方证白名单（特征贴提纲：太阴=腹满下利腹痛，少阳=呕胁满往来）
const TAIYIN_SHAOYANG_KEYS = [
  '大柴胡', '柴胡加芒硝', '柴胡桂枝', '柴胡加龙骨', '半夏泻心', '甘草泻心', '生姜泻心',
  '附子理中', '理中', '桂枝加芍药', '附子粳米', '大黄附子', '赤石脂禹余粮', '半夏干姜', '干姜人参半夏',
]

const all = [
  ...raw.dataset.filter(s => !evalTitles.has(s.title ?? '')),
  ...rawHints.dataset.filter(s =>
    s.via === 'meridian字段' || s.via === '口语方证' ||
    ((s.labelName === '太阴' || s.labelName === '少阳') && TAIYIN_SHAOYANG_KEYS.some(k => s.title.includes(k))), // 精选太阴温中方/少阳柴胡剂轻参与
  ).map(s => (s.via === 'meridian字段' || s.via === '口语方证') ? s : {...s, weightMul: 0.5}),
  ...rawRules.dataset.map(s => ({...s, weightMul: 0.5})), // 规则样本轻参与（密度高但会拉偏类别分布）
]
const freq: Record<string, number> = {}
for (const s of all) freq[s.labelName] = (freq[s.labelName] ?? 0) + 1
const meanFreq = all.length / CHANNELS.length
const FEATURE_SCALE = 50 // 特征归一化：0-100 → 0-2（与提纲案例同尺度，防梯度爆炸）
const dataset = all.map(s => {
  const label = CHANNEL_ZH.indexOf(s.labelName as (typeof CHANNEL_ZH)[number])
  if (label < 0) return null
  const weight = Math.sqrt(meanFreq / (freq[s.labelName] ?? 1)) * (s.weightMul ?? 1) // 类别平衡 × 轻参与系数
  return {features: s.features.map(x => x / FEATURE_SCALE), label, weight}
}).filter((x): x is NonNullable<typeof x> => x !== null)
console.log(`=== 六经辨证网络 v11：26 维 × 6 经 · 医案+方证+规则混合训练 ===`)
console.log(`数据集: ${dataset.length} 条（医案 ${raw.dataset.length - evalTitles.size} + 方证 ${rawHints.dataset.filter(s => s.via === 'meridian字段' || s.via === '口语方证').length} + 规则 ${rawRules.dataset.length}，评测留出 ${evalTitles.size}） 类别分布:`, JSON.stringify(freq))
console.log(`特征尺度: ÷${FEATURE_SCALE}  类别权重:`, JSON.stringify(Object.fromEntries(CHANNEL_ZH.map((c, i) => [c, Math.sqrt(meanFreq / freq[c]).toFixed(2)]))))

// 扩展版提纲（26 维，仅用于训练后对比，不参与训练）
const GUIDE: number[][] = [
  [1.2, 0.4, 0.3, -0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0.3, 0.3, 0, 0, 0, 0, 0],   // 太阳：恶寒发热汗出 脉浮紧 头项强痛身疼
  [-0.8, 0.5, 0.4, 1.2, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0.8, 0, 0, 0, 0.5, 0, 0, 0, -0.3, 0, 0, 0, 0], // 阳明：大渴便秘 脉大数 苔黄燥
  [0, 0, 0, 0, 1.2, 1.2, 0, 0, 0, 0, 0, 0.6, 0.8, 0.8, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0],   // 少阳：口苦往来 呕眩胁满 脉弦 默默不欲食
  [0.3, 0, 0, 0, 0, 0, 1.0, 1.0, 0, 0, 0, 0.4, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0],   // 太阴：腹满自利 呕 腹痛 纳差
  [0, 0, 0, 0, 0, 0, 0, 0.5, 1.0, 1.2, 0, 0, 0, 0, 0, -0.3, 0.6, 0, 0, 1.0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0], // 少阴：但欲寐厥冷 小便清长 脉微细沉 性功能（肾阳）
  [0, 0, 0, 0.8, 0, 0, 0, 0.4, 0.6, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0],     // 厥阴：消渴 下利厥冷 饥而不欲食
]

// 提纲 6 案（26 维，与数据集同尺度 ÷50）
const cases: {symptoms: number[], label: string, name: string}[] = [
  {symptoms: [90, 70, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 80, 0, 0, 0, 0, 0, 0, 70, 0, 35, 35, 0, 0, 0, 0, 0].map(x => x / 50), label: 'taiyang', name: '太阳·恶寒发热头身痛脉浮紧'},
  {symptoms: [0, 80, 80, 90, 0, 0, 0, 0, 0, 0, 70, 0, 0, 0, 0, 0, 0, 0, 80, 0, 80, 0, 0, 0, 0, 70, 0, 0, 0, 0, 0, 0, 0].map(x => x / 50), label: 'yangming', name: '阳明·大渴便秘脉大数苔黄'},
  {symptoms: [0, 0, 0, 0, 85, 85, 0, 0, 0, 0, 0, 60, 70, 70, 0, 0, 0, 0, 0, 0, 0, 70, 0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0].map(x => x / 50), label: 'shaoyang', name: '少阳·口苦往来呕眩胁满脉弦'},
  {symptoms: [30, 0, 0, 0, 0, 0, 85, 80, 0, 0, 0, 40, 0, 0, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 0, 0, 0, 0].map(x => x / 50), label: 'taiyin', name: '太阴·腹满自利腹痛纳差'},
  {symptoms: [0, 0, 0, 0, 0, 0, 0, 50, 85, 90, 0, 0, 0, 0, 0, 0, 60, 0, 0, 80, 0, 0, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(x => x / 50), label: 'shaoyin', name: '少阴·但欲寐厥冷脉微细沉'},
  {symptoms: [0, 0, 0, 85, 0, 0, 0, 30, 80, 0, 0, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(x => x / 50), label: 'jueyin', name: '厥阴·消渴厥冷错杂'},
]

function scoresOf(): number[] {
  const v = net.evaluateReference(source)
  return logits.map(w => v[w]!)
}
function diagnose(): string {
  const s = scoresOf()
  let best = 0
  for (let i = 1; i < CHANNELS.length; i++) if (s[i]! > s[best]!) best = i
  return CHANNEL_ZH[best]! // 返回中文经名
}
function setFeats(f: number[]) {
  for (let j = 0; j < inputCells.length; j++) source[inputCells[j]!] = f[j]!
}

console.log('\n=== 训练阶段 1：26 维提纲 6 案（从 0 学仲景结构） ===')
const guideDataset = cases.map(c => ({features: c.symptoms, label: CHANNELS.indexOf(c.label), weight: 1}))
trainSoftmax(net, validate, source, logits, inputCells, params, guideDataset, {
  steps: 300,
  lr: 2,
  weightDecay: 1e-3,
  logEvery: 100,
  onProgress: (step, l) => console.log(`  第${String(step).padStart(3)}步: 交叉熵=${l.toFixed(4)}`),
})

console.log('\n=== 训练阶段 2：混入医案+方证微调（提纲案做锚点） ===')
const mixed = [
  ...guideDataset.map(d => ({...d, weight: d.label === CHANNELS.indexOf('shaoyin') ? 12 : 5})), // 少阴锚点加强（但欲寐+脉微细是少阴主证，数据中被诸经稀释）
  ...dataset,
]
const {loss} = trainSoftmax(net, validate, source, logits, inputCells, params, mixed, {
  steps: 400,
  lr: 0.5,
  weightDecay: 1e-3,
  labelSmoothing: 0.05,
  logEvery: 100,
  onProgress: (step, l) => console.log(`  第${String(step).padStart(3)}步: 混合交叉熵=${l.toFixed(4)}`),
})
console.log(`  训练后混合交叉熵=${loss().toFixed(4)}`)

console.log('\n=== 验证 1：提纲 6 案 ===')
for (const cse of cases) {
  setFeats(cse.symptoms)
  validate(source)
  const got = diagnose()
  const gotIdx = CHANNEL_ZH.indexOf(got)
  const p = scoresOf()
  const ps = p.map(x => Math.exp(x - Math.max(...p)))
  const sum = ps.reduce((a, b) => a + b, 0)
  const prob = ps[CHANNELS.indexOf(cse.label)]! / sum
  console.log(`  ${cse.name.padEnd(16)} → ${CHANNEL_NAMES[CHANNELS[gotIdx]]!.padEnd(16)} 期望: ${CHANNEL_NAMES[cse.label]}  ${got === CHANNEL_ZH[CHANNELS.indexOf(cse.label)] ? '✓' : '✗'}  (P=${prob.toFixed(2)})`)
}

console.log('\n=== 验证 2：训练集分经准确率 ===')
const right: Record<string, [number, number]> = {}
for (const c of CHANNEL_ZH) right[c] = [0, 0]
for (const s of dataset) {
  setFeats(s.features)
  validate(source)
  const got = diagnose()
  const exp = CHANNEL_ZH[s.label]!
  right[exp]![1]++
  if (got === exp) right[exp]![0]++
}
let totR = 0, tot = 0
for (const c of CHANNEL_ZH) {
  const [r, n] = right[c]!
  totR += r; tot += n
  console.log(`  ${c}: ${r}/${n} (${(100 * r / n).toFixed(0)}%)`)
}
console.log(`  总体: ${totR}/${tot} (${(100 * totR / tot).toFixed(1)}%)`)

console.log('\n=== 验证 3：可解释性——学出权重 vs 仲景提纲 ===')
console.log('  症状序: ' + SYMPTOM_NAMES.join(' '))
for (let k = 0; k < CHANNELS.length; k++) {
  const learned = Array.from({length: SYMPTOMS.length}, (_, j) => source[W(k, j)]!).map(x => x.toFixed(2))
  const guide = GUIDE[k]!.map(x => x.toFixed(1))
  console.log(`  ${CHANNELS[k]!.padEnd(9)} 学得:[${learned.join(', ')}]`)
  console.log(`          提纲:[${guide.join(', ')}]  T=${source[T(k)]!.toFixed(1)}`)
}

// —— 导出训练好的权重（供 nh-predict.ts 推理加载）——
const weights: number[] = []
for (let k = 0; k < CHANNELS.length; k++)
  for (let j = 0; j < SYMPTOMS.length; j++) weights.push(source[W(k, j)]!)
const thresholds = Array.from({length: CHANNELS.length}, (_, k) => source[T(k)]!)
writeFileSync('nh-weights.json', JSON.stringify({
  weights,
  thresholds,
  dims: SYMPTOMS.map(s => s),
  channels: CHANNEL_ZH.map(c => c),
  trained: `${dataset.length} 条（医案 ${raw.dataset.length - evalTitles.size} + 方证 ${rawHints.dataset.filter(s => s.via === 'meridian字段' || s.via === '口语方证').length} + 规则 ${rawRules.dataset.length}）`,
}))
console.log('\n已导出权重 → nh-weights.json（' + weights.length + ' 权重 + ' + thresholds.length + ' 阈值）')
