// nh-eval.ts — 六经辨证独立评测（泛化能力测试）
// 加载 nh-eval-dataset.json（模型未见过的新医案）→ 推理 → 混淆矩阵 + 分经准确率 + Top2 命中率
// 用法：bun nh-eval.ts [--detail]   （--detail 打印每例明细）
import {readFileSync, writeFileSync} from 'node:fs'
import {loadWeights, featsFromText, predict} from './nh-engine.ts'

const W = loadWeights('nh-weights.json')
const ev = JSON.parse(readFileSync('nh-eval-dataset.json', 'utf8')) as {
  dataset: {title: string, label: string, labels: string[], symptoms: string, nDims: number, feats: number[], src: string}[]
}
const detail = process.argv.includes('--detail')

const CHANNELS = W.channels
const idx = (c: string) => CHANNELS.indexOf(c)

// 混淆矩阵 [预测][实际]
const conf: number[][] = CHANNELS.map(() => CHANNELS.map(() => 0))
const perRight: Record<string, [number, number]> = {}
for (const c of CHANNELS) perRight[c] = [0, 0]
let totR = 0, tot = 0, top2R = 0, noHit = 0
const bySrc: Record<string, [number, number]> = {} // src: [对, 总]

const lines: string[] = []
lines.push(`══════ 六经辨证 v8 独立评测报告 ══════`)
lines.push(`权重: 训练集剔除评测留出后重训`)
lines.push(`评测集: ${ev.dataset.length} 例（留出 ${ev.dataset.filter(s => s.src === 'holdout').length} + 新案例 ${ev.dataset.filter(s => s.src !== 'holdout').length}）`)
lines.push(`评测方式: 留出样本直接喂特征；新案例用医案原文提取症状维度 → 21 维 → softmax → 六经`)
lines.push(``)

for (const s of ev.dataset) {
  // 留出样本直接用构建时特征；新案例用症状文本提取
  let feats: number[], hits: string[]
  if (s.src === 'holdout' && s.feats && s.feats.some(x => x > 0)) {
    feats = s.feats
    hits = ['[留出]']
  } else {
    const r = featsFromText(s.symptoms)
    feats = r.feats; hits = r.hits
  }
  if (hits.length === 0) { noHit++; lines.push(`  ✗ ${s.title}（期望${s.label}）：症状未命中任何维度`); continue }
  const {probs, best, bestName} = predict(feats, W)
  const exp = s.label
  const expI = idx(exp)
  if (expI < 0) { lines.push(`  ? ${s.title}：未知标签 ${exp}`); continue }
  conf[best]![expI]!++
  perRight[exp]![1]++
  tot++
  bySrc[s.src] = bySrc[s.src] ?? [0, 0]
  bySrc[s.src]![1]++
  // Top2 是否包含期望
  const sorted = CHANNELS.map((c, i) => ({c, p: probs[i]!})).sort((a, b) => b.p - a.p)
  const top2Has = sorted[0]!.c === exp || sorted[1]!.c === exp
  if (bestName === exp) { perRight[exp]![0]++; totR++; top2R++; bySrc[s.src]![0]++ }
  else if (top2Has) top2R++
  if (detail) {
    const bar = '█'.repeat(Math.max(0, Math.round(probs[best]! * 20)))
    const mark = bestName === exp ? '✓' : top2Has ? '△' : '✗'
    lines.push(`  ${mark} ${s.title} | 期望:${exp} | 判:${bestName} ${(probs[best]! * 100).toFixed(0)}%${bar} | 命中:${hits.join('/')}`)
  }
}

lines.push(`\n── 分经准确率 ──`)
for (const c of CHANNELS) {
  const [r, n] = perRight[c]!
  if (n > 0) lines.push(`  ${c}: ${r}/${n} (${(100 * r / n).toFixed(0)}%)`)
  else lines.push(`  ${c}: 无样本`)
}
lines.push(`\n  总体: ${totR}/${tot} (${(100 * totR / tot).toFixed(1)}%)`)
lines.push(`  Top2 命中: ${top2R}/${tot} (${(100 * top2R / tot).toFixed(1)}%)`)
lines.push(`  分布内(留出): ${bySrc.holdout ? `${bySrc.holdout[0]}/${bySrc.holdout[1]} (${(100 * bySrc.holdout[0] / bySrc.holdout[1]).toFixed(0)}%)` : '无'}`)
lines.push(`  分布外(新案例): ${bySrc['03yian'] || bySrc['06other'] ? `${(bySrc['03yian'] ?? [0, 0])[0] + (bySrc['06other'] ?? [0, 0])[0]}/${(bySrc['03yian'] ?? [0, 0])[1] + (bySrc['06other'] ?? [0, 0])[1]}` : '无'}`)
if (noHit > 0) lines.push(`  症状零命中: ${noHit} 例（特征词典覆盖不足）`)

lines.push(`\n── 混淆矩阵（预测行 × 实际列）──`)
lines.push(`        ${CHANNELS.map(c => c.padEnd(4)).join(' ')}`)
for (let i = 0; i < CHANNELS.length; i++) {
  lines.push(`  ${CHANNELS[i]!.padEnd(4)} ${conf[i]!.map((n, j) => (i === j ? `[${String(n).padStart(2)}]` : String(n).padStart(4))).join(' ')}`)
}

// 纠缠分析：找最大非对角
lines.push(`\n── 主要纠缠（非对角最大混淆）──`)
const offDiag: {a: string, b: string, n: number}[] = []
for (let i = 0; i < CHANNELS.length; i++)
  for (let j = 0; j < CHANNELS.length; j++)
    if (i !== j && conf[i]![j]! > 0) offDiag.push({a: CHANNELS[i]!, b: CHANNELS[j]!, n: conf[i]![j]!})
offDiag.sort((a, b) => b.n - a.n)
for (const o of offDiag.slice(0, 6)) lines.push(`  ${o.b} 被误判为 ${o.a}: ${o.n} 例`)

const report = lines.join('\n')
console.log(report)
writeFileSync('nh-eval-report.txt', report)
console.log('\n报告已落盘 nh-eval-report.txt')
