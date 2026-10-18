// build-eval-dataset.ts v2 — 构建独立评测集（golden test set，双轨）
// 轨1 留出（hold-out）：nh-all-dataset.json 326 医案按标签分层抽样 60 例（每经 10），训练时剔除 → 分布内泛化
// 轨2 新案例（分布外）：03_yian 剩余带标签医案 + 06_other 手选医案（症状从原文提取，模型从未见过）
import {readFileSync, writeFileSync} from 'node:fs'
import {extractSymptomWords, DICT} from './nh-engine.ts'

// —— 轨1：分层留出（固定 seed 可复现）——
function seededRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const rng = seededRng(20261017)

const train = JSON.parse(readFileSync('nh-all-dataset.json', 'utf8')) as {
  dataset: {title: string, src: string, labelName: string, features: number[], via: string}[]
}
const HOLDOUT_PER = 10
const byLabel: Record<string, {title: string, labelName: string, features: number[]}[]> = {}
for (const s of train.dataset) {
  if (s.src !== 'yian' && s.src !== 'table') continue
  ;(byLabel[s.labelName] ??= []).push({title: s.title, labelName: s.labelName, features: s.features})
}
const holdout: {title: string, label: string, symptoms: string, feats: number[], src: string}[] = []
const CH_MAP: [string, string][] = [['太陽', '太阳'], ['陽明', '阳明'], ['少陽', '少阳'], ['太陰', '太阴'], ['少陰', '少阴'], ['厥陰', '厥阴']]
for (const ch of ['太阳', '阳明', '少阳', '太阴', '少阴', '厥阴']) {
  const pool = (byLabel[ch] ?? []).filter(p => {
    // 只保留标题含恰好一个六经词且与标签一致的可靠样本（1257 表病机标签清洗）
    const titleCh = CH_MAP.filter(([tr]) => p.title.includes(tr)).map(([, zh]) => zh)
    return titleCh.length === 1 && titleCh[0] === p.labelName
  })
  if (pool.length === 0) continue
  // 打乱取前 N
  const shuffled = [...pool].sort(() => rng() - 0.5)
  const picked = shuffled.slice(0, Math.min(HOLDOUT_PER, pool.length))
  for (const p of picked) {
    holdout.push({
      title: p.title, label: p.labelName,
      symptoms: `[留出]${p.labelName}`, feats: p.features.map(x => x * 50), src: 'holdout',
    })
  }
}

// —— 轨2：新案例（分布外，手选，症状来自原文/摘要）——
const fresh: {title: string, label: string, labels: string[], body: string, src: string}[] = [
  // 03_yian 剩余（build-eval v1 已确认 3 例）
  {title: '061128铁口直断', label: '少阴', labels: ['少阴'], body: '下利 呕 失眠 四肢冰冷', src: '03yian'},
  {title: '070123今天真多癌症病人', label: '阳明', labels: ['阳明'], body: '发热 汗出 便秘 失眠', src: '03yian'},
  {title: '081016乳癌末期案例', label: '阳明', labels: ['阳明'], body: '发热 失眠', src: '03yian'},
  // 06_other 手选（症状从摘要/问诊原文提取）
  {title: '06other-121葛根汤症', label: '太阳', labels: ['太阳'], body: '头胀痛 发热 畏寒 无汗 后项到小腿肚酸痛 喉痛 鼻涕倒流 脉浮紧数', src: '06other'},
  {title: '06other-71抗生素维他命', label: '少阴', labels: ['少阴', '厥阴'], body: '长期倦怠 失眠 月经不规则 手脚冰冷 脉沉细', src: '06other'},
  {title: '06other-85腹痛急诊', label: '厥阴', labels: ['厥阴'], body: '焦虑 恐惧 面色惨白 呼吸短促 左肩左项痛 腹痛', src: '06other'},
  {title: '06other-90肾脏病', label: '太阳', labels: ['太阳'], body: '右侧肾脏极度疼痛 小便带血 双脚浮肿 便秘严重', src: '06other'},
  {title: '06other-132ALS渐冻症', label: '少阴', labels: ['少阴'], body: '右腿无法行走 无力 抽筋 双手臂无力上举 后项强痛 背痛', src: '06other'},
  {title: '06other-168不孕症', label: '阳明', labels: ['阳明'], body: '怀孕水肿 血压高 怕热 口渴', src: '06other'},
  {title: '06other-183医案167', label: '阳明', labels: ['阳明'], body: '便秘二至三天一次 胃口很好 睡眠尚好 口渴少 乳房涨感 月经血块', src: '06other'},
  {title: '06other-179男子表症', label: '太阳', labels: ['太阳', '少阳'], body: '脖子后面背酸痛 无汗 疼痛 口干', src: '06other'},
]

for (const f of fresh) {
  const words = extractSymptomWords(f.body)
  const joined = f.body
  const feats: number[] = []
  for (const d of Object.keys(DICT)) {
    let n = 0
    for (const w of DICT[d] ?? []) {
      let i = 0
      while ((i = joined.indexOf(w, i)) !== -1) { n++; i += w.length }
    }
    feats.push(Math.min(100, n * 40))
  }
  holdout.push({title: f.title, label: f.label, symptoms: words.join(' '), feats, src: f.src})
}
// 注：太阴/少阳 yian 字段标签为病机标签（如"脑中风→太阴"），症状文本无可判特征，不加入评测集
// （评测样本必须症状可判；病机标签样本由 06_other 症状充分案例替代）

// —— 汇总输出 ——
const dist: Record<string, number> = {}
for (const c of holdout) dist[c.label] = (dist[c.label] ?? 0) + 1
console.log(`评测集构建完成：${holdout.length} 例（留出 ${holdout.filter(c => c.src === 'holdout').length} + 新案例 ${holdout.filter(c => c.src !== 'holdout').length}）`)
console.log('标签分布:', JSON.stringify(dist))
console.log('平均命中维度(新案例):', (holdout.filter(c => c.src !== 'holdout').reduce((a, c) => a + c.symptoms.split(' ').length, 0) / holdout.filter(c => c.src !== 'holdout').length).toFixed(2))
console.log('留出样例:', holdout.filter(c => c.src === 'holdout').slice(0, 4).map(c => `${c.title}→${c.label}`).join(' | '))

writeFileSync('nh-eval-dataset.json', JSON.stringify({
  desc: '六经辨证独立评测集 v2（留出60+新案例11，训练时须按 title 剔除 holdout）',
  holdoutTitles: holdout.filter(c => c.src === 'holdout').map(c => c.title),
  dataset: holdout,
}))
console.log('已写入 nh-eval-dataset.json')
