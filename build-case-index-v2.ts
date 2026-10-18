// build-case-index-v2.ts — 医案直证索引 v2：合并 1257 例表 + 03_yian.md 叙事医案
// 每案：{title, disease, jibing, formulas, symWords(剔除好转/阴性表述), bodyLen}
import {readFileSync, writeFileSync} from 'node:fs'
import {extractMatchedWords, simplify} from './nh-engine.ts'

const OUT = 'nh-case-index.json'

// ============ 源A: merged-table.md（1257 例结构化） ============
const table = readFileSync('merged-table.md', 'utf8')
const tableRows = table.split('\n').filter(l => /^\| ?\d+ \|/.test(l))
console.log(`1257 例表数据行: ${tableRows.length}`)

type CaseIdx = {title: string, disease: string, jibing: string, formulas: string, symWords: string[], bodyLen: number, src: string}
const cases: CaseIdx[] = []

// 剔除好转/阴性状态词（只删状态词本身，保留"失眠好轉"里的"失眠"）
function cleanNeg(text: string): string {
  return text
    .replace(/好轉|好转|已好|已正常|正常了|消失|不再|減輕|减轻|減退|减退/g, ' ')
    .replace(/[。；，、]+/g, ' ')
}
for (const line of tableRows) {
  const cells = line.split('|').map(c => c.trim())
  if (cells.length < 12) continue
  const no = cells[1]!
  const jibing = cells[4] ?? ''
  const disease = cells[5] ?? ''
  const formula = cells[7] ?? ''
  const outcome = cells[10] ?? ''
  // 诊断列净化：评述性长文本（"你是笨死的"）不是诊断 → 退回病机/序号
  const isRant = disease.length > 20 && /[的了死而已](?:，|。|$)|你|我|他/.test(disease)
  const title = isRant ? `M${no}·${(jibing || '医案').slice(0, 12)}` : `M${no}·${disease.slice(0, 12) || '医案'}`
  // 症状词来源：病机+诊断+疗程结果+方剂注释（酸棗仁(可治療失眠 → 命中"失眠"）
  const symWords = extractMatchedWords(simplify(cleanNeg(jibing + ' ' + disease + ' ' + outcome + ' ' + formula)))
  cases.push({title, disease: (isRant ? jibing : disease).slice(0, 40), jibing: jibing.slice(0, 60), formulas: formula.slice(0, 150), symWords, bodyLen: formula.length, src: 'table'})
}

// ============ 源B: 03_yian.md 叙事医案（复用 build-case-index 逻辑） ============
const yianText = readFileSync(process.env.NH_YIAN_PATH ?? '03_yian.md', 'utf8')
const hints = JSON.parse(readFileSync('nh-hints-dataset.json', 'utf8')) as {dataset: {title: string}[]}
const FORMULA_NAMES = [...new Set(hints.dataset.map((s: any) => s.title))]
const blocks = yianText.split(/\n(?=### )/).filter(b => b.startsWith('### '))
let yianCount = 0
for (const b of blocks) {
  const title = b.match(/^### (.+)/)?.[1] ?? ''
  const disease = b.match(/^\*\*疾病\*\*：(.+)$/m)?.[1] ?? ''
  const bodyMatch = b.match(/^\*\*医案内容\*\*：\s*(.+)$/ms)
  const body = bodyMatch ? bodyMatch[1]!.trim() : ''
  if (!body) continue
  const clipped = body.length > 4000 ? body.slice(0, 4000) : body
  const symWords = extractMatchedWords(simplify(cleanNeg(clipped)))
  const formulas = FORMULA_NAMES.filter(f => simplify(clipped).includes(f))
  cases.push({title, disease: disease.slice(0, 40), jibing: '', formulas: formulas.join(','), symWords, bodyLen: body.length, src: 'yian'})
  yianCount++
}
console.log(`03_yian 叙事医案: ${yianCount}`)

// 过滤：无任何症状词的医案对直证无用（但保留极少数有方剂的）
const usable = cases.filter(c => c.symWords.length >= 1 || c.formulas)
console.log(`总医案: ${cases.length}，可用(含症状词或方剂): ${usable.length}`)
const withSym = usable.filter(c => c.symWords.length >= 1).length
console.log(`含症状词: ${withSym}  平均词数: ${(usable.reduce((a, c) => a + c.symWords.length, 0) / Math.max(1, usable.length)).toFixed(1)}`)

// 抽样
for (const c of usable.slice(0, 8)) {
  console.log(`[${c.src}|${c.title}] 病=${c.disease.slice(0, 15)} 词=${c.symWords.slice(0, 6).join(',')} 方=${c.formulas.slice(0, 30)}`)
}
writeFileSync(OUT, JSON.stringify(usable, null, 1), 'utf8')
console.log(`已写入 ${OUT}（${usable.length} 条）`)
