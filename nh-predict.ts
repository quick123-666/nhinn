// nh-predict.ts — 六经辨证网络 v15 推理入口（含医案直证）
// 用法：
//   bun nh-predict.ts "怕冷发烧没汗 全身酸痛"
//   bun nh-predict.ts "手脚冰冷 拉肚子没消化 但欲寐"
// 输入：中文症状描述（自然语言，空格/逗号分隔），命中 33 维词典即计入
// 输出：六经评分排序 + 最佳辨证 + 推荐方剂 + 概率 + 医案直证（命中的倪师真实医案）
import {loadWeights, featsFromText, extractMatchedWords, DIM_ZH} from './nh-engine.ts'
import {readFileSync} from 'node:fs'

const W = loadWeights('nh-weights.json')

// 医案直证索引（1302 条：1257 例表 + 03_yian 叙事医案）
type CaseIdx = {title: string, disease: string, jibing: string, formulas: string, symWords: string[], bodyLen: number, src: string}
let CASE_INDEX: CaseIdx[] = []
try { CASE_INDEX = JSON.parse(readFileSync('nh-case-index.json', 'utf8')) as CaseIdx[] } catch {}

const FORMULA_MAIN: Record<string, string> = {
  '太阳': '桂枝汤/麻黄汤', '阳明': '白虎汤/承气汤', '少阳': '小柴胡汤', '太阴': '理中汤', '少阴': '四逆汤', '厥阴': '乌梅丸',
}
const FORMULA_DETAIL: Record<string, string> = {
  '太阳': '桂枝汤 / 麻黄汤 / 葛根汤（有汗→桂枝，无汗→麻黄）',
  '阳明': '白虎汤 / 承气汤（经热→白虎，腑实→承气）',
  '少阳': '小柴胡汤（和解少阳）',
  '太阴': '理中汤（温中健脾）',
  '少阴': '四逆汤 / 真武汤（回阳救逆 / 温阳利水）',
  '厥阴': '乌梅丸（寒热并用）',
}
const CHANNEL_SYMPTOM_ZH: Record<string, string> = {
  '太阳': '恶寒发热脉浮', '阳明': '大渴便秘脉大苔黄', '少阳': '口苦咽干目眩胁满', '太阴': '腹满自利腹痛', '少阴': '但欲寐厥冷脉微', '厥阴': '消渴厥冷错杂',
}

// ============ 主流程 ============
const input = process.argv.slice(2).join(' ')
if (!input.trim()) {
  console.log('用法: bun nh-predict.ts "怕冷发烧没汗 全身酸痛"')
  console.log('      bun nh-predict.ts "手脚冰冷 拉肚子 嗜睡"')
  console.log('中文症状描述即可（支持繁体），自动匹配 33 维症状词典')
  process.exit(0)
}

const {feats, hits} = featsFromText(input)
if (hits.length === 0) {
  console.log('未匹配到任何已知症状维度。可识别的维度：')
  console.log('  恶寒 发热 汗出 口渴 口苦 往来寒热 腹满 下利 厥冷 但欲寐')
  console.log('  便秘 呕 咽干目眩 胸胁苦满 腹痛 失眠 小便清长 脉浮 脉大 脉微细 舌苔黄燥')
  process.exit(1)
}

const {scores, probs, best, bestName} = predictRaw(feats)

function predictRaw(feats: number[]) {
  const scaled = feats.map(x => x / 50)
  const scores = W.channels.map((_, k) => {
    let s = -W.thresholds[k]!
    for (let j = 0; j < W.dims.length; j++) s += W.weights[k * W.dims.length + j]! * scaled[j]!
    return s
  })
  const mx = Math.max(...scores)
  const exps = scores.map(x => Math.exp(x - mx))
  const sum = exps.reduce((a, b) => a + b, 0)
  const probs = exps.map(x => x / sum)
  let best = 0
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[best]!) best = i
  return {scores, probs, best, bestName: W.channels[best]!}
}

console.log(`\n══════ 六经辨证 · v17（${W.trained}）══════`)
console.log(`输入症状: ${input}`)
console.log(`命中维度: ${hits.map(h => DIM_ZH[h] ?? h).join('、') || '无'}`)
console.log(`\n各经评分:`)
for (let i = 0; i < W.channels.length; i++) {
  const bar = '█'.repeat(Math.max(0, Math.round(probs[i]! * 20)))
  console.log(`  ${W.channels[i]!.padEnd(3)} ${scores[i]!.toFixed(2).padStart(7)}   ${(probs[i]! * 100).toFixed(1).padStart(5)}%  ${bar}${i === best ? '  ← 辨证' : ''}`)
}
console.log(`\n═══ 辨证结论: ${bestName}病（${CHANNEL_SYMPTOM_ZH[bestName] ?? ''}）═══`)
console.log(`推荐方剂: ${FORMULA_MAIN[bestName]}`)
console.log(`方剂说明: ${FORMULA_DETAIL[bestName]}`)

// ============ 医案直证：症状词重叠检索倪师真实医案 ============
if (CASE_INDEX.length > 0) {
  const inputWords = extractMatchedWords(input)
  const scored = CASE_INDEX
    .map(c => ({c, overlap: inputWords.filter(w => c.symWords.includes(w)).length}))
    .filter(x => x.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap || a.c.symWords.length - b.c.symWords.length)
    .slice(0, 3)
  console.log(`\n── 医案直证（命中 ${scored.length} 个倪师真实医案，重叠症状词≥2）──`)
  if (scored.length === 0) {
    console.log('  （无强命中；以下为 1 词相关医案，供参考）')
    const weak = CASE_INDEX
      .map(c => ({c, overlap: inputWords.filter(w => c.symWords.includes(w)).length}))
      .filter(x => x.overlap === 1)
      .sort((a, b) => (a.c.formulas ? 0 : 1) - (b.c.formulas ? 0 : 1))
      .slice(0, 2)
    for (const {c, overlap} of weak) {
      const words = inputWords.filter(w => c.symWords.includes(w))
      console.log(`  · [${c.src}] ${c.title} — 重叠:${words.join(',')} 方剂:${c.formulas.slice(0, 80) || '(未公开)'}`)
    }
  } else {
    for (const {c, overlap} of scored) {
      const words = inputWords.filter(w => c.symWords.includes(w))
      console.log(`  ${c.title}`)
      console.log(`    诊断: ${c.disease.slice(0, 40) || c.jibing.slice(0, 40) || '—'}  重叠: ${words.join('、')}`)
      console.log(`    方剂: ${c.formulas.slice(0, 110) || '(原文未公开方)'}`)
    }
  }
}

console.log('\n提示：本结果基于 483 条医案/方证/规则训练的神经网络 + 1302 条医案直证，仅作学习参考，不构成医疗建议。')
