// build-all-dataset.ts — 六经辨证训练数据统一构建（21 维症状 + 多源合并）
// 源A: merged-table.md（jangviktor 1257 例结构化表）
// 源B: niehaixia skill modules/03_yian.md（410 条医案集）
// 标签策略（优先级）: 字段六经 > 全行经方映射 > 六经关键词（病机/诊断/正文）
// 多标签: 取第一个为主标签
import {readFileSync, writeFileSync} from 'node:fs'

const OUT = 'nh-all-dataset.json'

// —— 繁→简（覆盖六经/症状/药味/方名涉及用字）——
const SIMPLIFY: [string, string][] = [
  ['陽', '阳'], ['陰', '阴'], ['經', '经'], ['證', '证'], ['湯', '汤'], ['實', '实'], ['脈', '脉'],
  ['體', '体'], ['發', '发'], ['熱', '热'], ['頭', '头'], ['虛', '虚'], ['風', '风'], ['見', '见'],
  ['裡', '里'], ['勝', '胜'], ['復', '复'], ['結', '结'], ['濕', '湿'], ['膽', '胆'], ['腎', '肾'],
  ['腸', '肠'], ['痺', '痹'], ['癒', '愈'], ['劑', '剂'], ['藥', '药'], ['補', '补'], ['診', '诊'],
  ['問', '问'], ['處', '处'], ['對', '对'], ['鬱', '郁'], ['龍', '龙'], ['蒼', '苍'], ['術', '术'],
  ['當', '当'], ['萬', '万'], ['與', '与'], ['無', '无'], ['氣', '气'], ['關', '关'], ['節', '节'],
  ['來', '来'], ['個', '个'], ['這', '这'], ['說', '说'], ['話', '话'], ['時', '时'], ['後', '后'],
  ['東', '东'], ['兩', '两'], ['學', '学'], ['為', '为'], ['於', '于'], ['並', '并'], ['從', '从'],
  ['眾', '众'], ['國', '国'], ['嗎', '吗'], ['沒', '没'], ['過', '过'], ['長', '长'], ['間', '间'],
  ['點', '点'], ['讀', '读'], ['寫', '写'], ['傳', '传'], ['轉', '转'], ['輕', '轻'], ['難', '难'],
  ['離', '离'], ['動', '动'], ['幫', '帮'], ['帶', '带'], ['張', '张'], ['覺', '觉'], ['絕', '绝'],
  ['銀', '银'], ['錢', '钱'], ['應', '应'], ['聲', '声'], ['驗', '验'], ['檢', '检'], ['細', '细'],
  ['級', '级'], ['約', '约'], ['質', '质'], ['針', '针'], ['灸', '灸'], ['癥', '症'],
  ['惡', '恶'], ['滿', '满'], ['脹', '胀'], ['瀉', '泻'], ['腳', '脚'], ['煩', '烦'], ['嚨', '咙'],
  ['脅', '胁'], ['黃', '黄'], ['連', '连'], ['烏', '乌'], ['陳', '陈'], ['梔', '栀'], ['膠', '胶'],
  ['參', '参'], ['歸', '归'], ['朮', '术'], ['澤', '泽'], ['豬', '猪'], ['乾', '干'], ['薑', '姜'],
  ['棗', '枣'], ['紅', '红'], ['噁', '恶'], ['頻', '频'], ['緊', '紧'], ['緩', '缓'],
  ['鬱', '郁'], ['沈', '沉'], ['裏', '里'], ['牋', '笺'], ['祕', '秘'], ['乾', '干'],
]
function simplify(text: string): string {
  let t = text
  for (const [tr, si] of SIMPLIFY) t = t.split(tr).join(si)
  return t
}

// —— 21 维症状（仲景提纲 + 倪师十问 + 脉舌）——
const DIMS = [
  {key: 'wuhan', name: '恶寒', words: ['怕冷', '恶寒', '畏寒', '很冷', '感觉冷', '觉得冷', '发冷', '冷飕飕', '怕风', '恶风', '畏冷', '怕寒', '寒战', '冷颤']},
  {key: 'fare', name: '发热', words: ['发热', '发烧', '觉得热', '燥热', '热症', '身热', '体温高', '怕热', '烦热', '炙热', '全身热', '身体热', '面赤热']},
  {key: 'hanchu', name: '汗出', words: ['流汗', '出汗', '盗汗', '汗出', '易流汗', '汗多', '汗流不止', '出汗多', '容易出汗', '流汗多']},
  {key: 'kouke', name: '口渴', words: ['口渴', '烦渴', '大渴', '想喝水', '渴', '引饮', '口干', '嘴干', '口乾', '干渴', '渴饮']},
  {key: 'kouku', name: '口苦', words: ['口苦', '口干苦', '苦味', '口臭']},
  {key: 'wanglai', name: '往来寒热', words: ['往来寒热', '忽冷忽热', '寒热往来', '一阵冷一阵热', '冷热交替', '时冷时热']},
  {key: 'fuman', name: '腹满', words: ['腹满', '腹胀', '胀满', '肚子胀', '心下痞', '腹大', '腹部胀', '腹坚', '腹部胀满', '腹胀如鼓']},
  {key: 'xiali', name: '下利', words: ['下利', '腹泻', '拉肚子', '下痢', '大便溏', '泄泻', '溏便', '水泻', '利不止', '便稀', '拉稀', '大便稀', '水样便', '溏泄']},
  {key: 'jueleng', name: '厥冷', words: ['手脚冰冷', '四肢冰冷', '厥冷', '冰冷', '双脚冰冷', '手脚冷', '手脚都冷', '四肢冷', '手冷脚冷', '脚冰冷', '手足冷', '足冷', '脚冷', '手冷', '四肢逆冷', '手足逆冷']},
  {key: 'danwumei', name: '但欲寐', words: ['嗜睡', '昏昏欲睡', '但欲寐', '想睡', '疲倦欲睡', '一直睡', '爱睡觉', '白日昏睡', '倦怠无力', '精神萎靡', '无力倦怠', '很累想睡']},
  {key: 'bianmi', name: '便秘', words: ['便秘', '大便不出', '大便难', '无排便', '宿便', '大便不顺畅', '排不出', '不大便', '没有大便', '排便困难', '大便干燥', '大便干', '大便干结', '大便困难', '不排便']},
  {key: 'ou', name: '呕', words: ['呕', '恶心', '干呕', '欲呕', '吐', '反胃', '想吐', '呕吐']},
  {key: 'yanmu', name: '咽干目眩', words: ['咽干', '喉咙干', '目眩', '头晕', '眩晕', '眩', '头昏', '头晕目眩', '咽喉干']},
  {key: 'xiongxie', name: '胸胁苦满', words: ['胸胁', '胁痛', '胁下痛', '胸胁满', '肋下', '胸满', '苦满', '胁满', '胸胁痛', '胁下痞', '胸胁苦满']},
  {key: 'futong', name: '腹痛', words: ['腹痛', '腹中痛', '肚子痛', '小腹痛', '腹绞痛', '喜按', '拒按', '腹满痛', '肚痛', '腹部痛', '腹中绞痛']},
  {key: 'shimian', name: '失眠', words: ['失眠', '无法入眠', '不易入眠', '睡不着', '睡不好', '无法睡', '不能睡', '半夜醒', '睡时醒', '无法回睡', '不好睡', '不易入睡', '入睡困难', '难入睡', '易醒', '早醒', '睡眠不好', '睡眠差']},
  {key: 'xiaobian', name: '小便清长', words: ['小便清长', '小便色白', '小便白', '频尿', '夜尿', '小便不利', '无法排尿', '尿不出', '尿失禁', '小便多', '尿多', '小便频数']},
  {key: 'maifu', name: '脉浮', words: ['脉浮', '浮脉', '浮缓', '浮紧', '脉浮数', '浮大', '脉浮缓', '脉浮紧']},
  {key: 'maida', name: '脉大', words: ['脉大', '洪大', '脉洪', '脉数大', '大脉', '洪数', '脉洪大', '洪脉', '脉大数']},
  {key: 'maiwei', name: '脉微细', words: ['脉微细', '微细', '脉细', '脉无力', '脉微', '脉缓无力', '微脉', '脉弱', '脉细欲绝', '脉微欲绝', '脉微弱', '脉虚', '脉细弱', '脉弱无力', '脉虚细', '脉结代']},
  {key: 'shehuang', name: '舌苔黄燥', words: ['舌苔黄', '黄燥', '苔黄', '舌红', '黄厚', '舌苔黄厚', '舌黄', '黄干', '苔黄干', '黄苔', '舌红苔黄', '舌苔黄干']},
  {key: 'maixuan', name: '脉弦', words: ['脉弦', '弦脉', '弦细', '脉弦细', '弦滑', '脉弦滑', '弦紧', '脉弦紧', '弦数', '脉弦数']},
  {key: 'maichen', name: '脉沉', words: ['脉沉', '沉脉', '沉细', '脉沉细', '脉沉紧', '脉沉迟', '沉弱', '脉沉弱', '脉微沉', '沉取']},
  {key: 'maichi', name: '脉迟', words: ['脉迟', '迟脉', '脉迟弱', '迟紧']},
  {key: 'maijin', name: '脉紧', words: ['脉紧', '紧脉', '脉浮紧', '浮紧', '脉弦紧']},
  {key: 'maishuo', name: '脉数', words: ['脉数', '数脉', '脉滑数', '脉洪数', '脉细数', '脉弦数', '脉浮数']},
  {key: 'toutong', name: '头痛', words: ['头痛', '头项强痛', '头项痛', '头疼', '后项痛', '项背强', '头胀痛', '前额痛', '偏头痛', '头重', '头如裹', '巅顶痛', '项强', '颈项强', '后颈痛', '太阳穴痛']},
  {key: 'shentong', name: '身痛', words: ['身痛', '身疼', '骨节痛', '骨节疼痛', '腰痛', '关节痛', '全身酸痛', '身体酸痛', '肌肉酸痛', '四肢痛', '臂痛', '腿痛', '膝痛', '背痛', '身疼痛', '通身疼痛', '身疼腰痛', '骨节烦痛']},
  {key: 'weikou', name: '胃口', words: ['胃口好', '胃口差', '没有胃口', '没胃口', '食欲不振', '厌食', '吃得下', '吃不下', '不想吃', '胃口不佳', '纳差', '纳呆', '善饥', '容易饿', '食不下', '胃口过好', '胃口很大', '食欲好', '能吃', '食欲差']},
  {key: 'kesou', name: '咳嗽', words: ['咳嗽', '咳', '干咳', '咳痰', '痰多', '有痰', '痰少', '咳喘', '咳逆', '咳嗽气喘', '咳而喘', '咳血', '咳唾', '痰饮', '气喘', '气短', '呼吸短促', '哮喘', '不能平卧', '咳引胁痛', '咳嗽不止', '阵咳', '喉中痰鸣']},
  {key: 'shuizhong', name: '水肿', words: ['水肿', '浮肿', '脚肿', '腿肿', '眼睑浮肿', '全身浮肿', '水气', '水饮', '小便不利', '身体肿', '面目浮肿', '下肢浮肿', '脚踝肿', '腹部积水', '腹水', '四肢肿', '晨起眼肿', '水肿不退', '水停', '尿少']},
  {key: 'yuejing', name: '月经', words: ['月经不调', '月经不来', '经水', '月经过多', '白带', '带下', '崩漏', '月经量少', '月经量多', '行经', '经前', '乳房胀痛', '经痛', '月经推迟', '月经提前', '经色', '末次月经', '痛经', '闭经']},
  {key: 'xinggong', name: '性功能', words: ['阳痿', '早泄', '遗精', '失精', '晨勃', '勃起', '性欲', '梦遗', '滑精', '不举', '阳举', '精子']},
] as const

const CHANNELS = ['太阳', '阳明', '少阳', '太阴', '少阴', '厥阴']

// 经方→六经映射（仲景标准归属，仅无争议方）
const FORMULA_MAP: [string, string][] = [
  ['桂枝汤', '太阳'], ['麻黄汤', '太阳'], ['葛根汤', '太阳'], ['大青龙汤', '太阳'], ['小青龙汤', '太阳'],
  ['五苓散', '太阳'], ['麻黄杏仁甘草石膏汤', '太阳'], ['麻杏甘石', '太阳'], ['茯苓桂枝白术甘草汤', '太阳'],
  ['苓桂术甘', '太阳'], ['桂枝甘草汤', '太阳'], ['桂枝加葛根汤', '太阳'], ['桂枝加附子汤', '太阳'],
  ['桂枝加厚朴杏子汤', '太阳'], ['桂枝人参汤', '太阳'], ['桂枝汤加附子', '太阳'],
  ['白虎汤', '阳明'], ['白虎加人参汤', '阳明'], ['承气汤', '阳明'], ['栀子豉汤', '阳明'], ['茵陈蒿汤', '阳明'],
  ['麻子仁丸', '阳明'], ['葛根芩连汤', '阳明'],
  ['小柴胡汤', '少阳'], ['大柴胡汤', '少阳'], ['柴胡桂枝汤', '少阳'], ['柴胡桂枝干姜汤', '少阳'],
  ['理中汤', '太阴'], ['附子理中', '太阴'], ['桂枝加芍药汤', '太阴'], ['小建中汤', '太阴'],
  ['四逆汤', '少阴'], ['通脉四逆汤', '少阴'], ['真武汤', '少阴'], ['附子汤', '少阴'], ['麻黄附子细辛汤', '少阴'],
  ['白通汤', '少阴'], ['黄连阿胶汤', '少阴'], ['桃花汤', '少阴'], ['桂枝芍药知母汤', '少阴'],
  ['乌梅丸', '厥阴'], ['当归四逆汤', '厥阴'], ['干姜黄芩黄连人参汤', '厥阴'], ['麻黄升麻汤', '厥阴'], ['白头翁汤', '厥阴'],
]

// —— 经方药味指纹 → 六经（1257 表方剂列是药味组合，用指纹反推）——
const HERB_ALIASES: [string, string][] = [
  ['炙甘草', '甘草'], ['甘草', '甘草'], ['生附子', '附子'], ['炮附子', '附子'], ['附子', '附子'],
  ['生半夏', '半夏'], ['法半夏', '半夏'], ['半夏', '半夏'],
  ['白芍', '白芍'], ['芍药', '白芍'], ['芍藥', '白芍'],
  ['生薑', '生姜'], ['生薑', '生姜'], ['生姜', '生姜'], ['乾薑', '干姜'], ['干薑', '干姜'], ['干姜', '干姜'],
  ['大棗', '大枣'], ['大枣', '大枣'], ['紅棗', '大枣'], ['红枣', '大枣'],
  ['黃芩', '黄芩'], ['黄芩', '黄芩'], ['黃連', '黄连'], ['黄连', '黄连'], ['黃柏', '黄柏'], ['黄柏', '黄柏'],
  ['麻黃', '麻黄'], ['麻黄', '麻黄'],
  ['白朮', '白术'], ['白朮', '白术'], ['白术', '白术'], ['蒼朮', '白术'],
  ['澤瀉', '泽泻'], ['泽泻', '泽泻'], ['豬苓', '猪苓'], ['猪苓', '猪苓'],
  ['細辛', '细辛'], ['细辛', '细辛'], ['當歸', '当归'], ['當歸', '当归'], ['当归', '当归'],
  ['大黃', '大黄'], ['大黄', '大黄'], ['枳實', '枳实'], ['枳实', '枳实'],
  ['烏梅', '乌梅'], ['乌梅', '乌梅'], ['茵陳', '茵陈'], ['茵陈', '茵陈'], ['梔子', '栀子'], ['栀子', '栀子'],
  ['阿膠', '阿胶'], ['阿胶', '阿胶'], ['人參', '人参'], ['人參', '人参'], ['人参', '人参'], ['黨參', '人参'], ['党参', '人参'],
  ['白頭翁', '白头翁'], ['白头翁', '白头翁'],
  ['玉金', '玉金'], ['龍膽草', '龙胆草'],
]
// 指纹规则：命中即判六经，按特异→一般排序
const FINGERPRINT_RULES: [string[], string][] = [
  [['乌梅'], '厥阴'],                                 // 乌梅丸
  [['白头翁'], '厥阴'],                               // 白头翁汤
  [['阿胶', '黄连'], '少阴'],                          // 黄连阿胶汤
  [['附子', '干姜', '甘草'], '少阴'],                  // 四逆汤/通脉四逆
  [['麻黄', '附子', '细辛'], '少阴'],                  // 麻黄附子细辛汤
  [['附子', '白术', '茯苓', '白芍'], '少阴'],          // 真武汤
  [['附子', '白术', '茯苓', '人参'], '少阴'],          // 附子汤
  [['石膏', '知母'], '阳明'],                          // 白虎汤
  [['大黄', '芒硝'], '阳明'],                          // 承气汤
  [['大黄', '厚朴', '枳实'], '阳明'],                  // 承气家族
  [['茵陈', '栀子'], '阳明'],                          // 茵陈蒿汤
  [['栀子', '豆豉'], '阳明'],                          // 栀子豉汤
  [['石膏', '麻黄', '杏仁'], '太阳'],                  // 麻杏甘石汤
  [['麻黄', '桂枝', '杏仁'], '太阳'],                  // 麻黄汤
  [['麻黄', '桂枝', '葛根'], '太阳'],                  // 葛根汤
  [['麻黄', '桂枝', '细辛', '干姜'], '太阳'],          // 小青龙汤
  [['麻黄', '石膏', '桂枝'], '太阳'],                  // 大青龙汤
  [['桂枝', '白芍', '甘草', '大枣', '生姜'], '太阳'],  // 桂枝汤家族
  [['茯苓', '桂枝', '白术'], '太阳'],                  // 苓桂术甘汤
  [['猪苓', '泽泻', '茯苓', '桂枝'], '太阳'],          // 五苓散
  [['柴胡', '黄芩', '半夏'], '少阳'],                  // 小柴胡/大柴胡/柴胡桂枝
  [['柴胡', '黄芩', '人参'], '少阳'],                  // 小柴胡（无半夏写法）
  [['柴胡', '黄芩', '大黄', '枳实'], '少阳'],          // 大柴胡（无半夏写法）
  [['人参', '白术', '干姜', '甘草'], '太阴'],          // 理中汤
  [['当归', '细辛'], '厥阴'],                          // 当归四逆汤（乌梅丸已被拦截）
  [['黄连', '黄芩', '人参', '干姜'], '厥阴'],          // 干姜黄芩黄连人参汤
]
function herbsIn(text: string): Set<string> {
  // 去剂量与数字，切词
  const cleaned = simplify(text)
    .replace(/[0-9０-９一二三四五六七八九十百零两兩]+[钱錢两兩克g枚片斤升]/g, ' ')
    .replace(/[0-9０-９一二三四五六七八九十百零两兩]+/g, ' ')
    .replace(/[，。、,;；()（）【】\[\]:：\s]+/g, ' ')
  const herbs = new Set<string>()
  for (const [raw, norm] of HERB_ALIASES) {
    if (cleaned.includes(raw)) herbs.add(norm)
  }
  return herbs
}
function fingerprintToLiuJing(text: string): string | null {
  if (!text || text.includes('未提及') || text.includes('未公開') || text.includes('未公开')) return null
  const herbs = herbsIn(text)
  if (herbs.size === 0) return null
  for (const [need, ch] of FINGERPRINT_RULES) {
    if (need.every(h => herbs.has(h))) return ch
  }
  return null
}

type Sample = {id: number, src: string, title: string, features: number[], labelName: string, via: string}

function extractFeatures(...texts: string[]): number[] {
  const joined = simplify(texts.join(' '))
  return DIMS.map(d => {
    let n = 0
    for (const w of d.words) {
      let i = 0
      while ((i = joined.indexOf(w, i)) !== -1) { n++; i += w.length }
    }
    return Math.min(100, n * 40)
  })
}

function formulaToLiuJing(text: string): string | null {
  const t = simplify(text)
  for (const [f, ch] of FORMULA_MAP) if (t.includes(f)) return ch
  return null
}
function textToLiuJing(text: string): string | null {
  // "厥阴症/在阳明/太阳病/停在少阳与阳明之间/病入厥阴/出现厥阴死症/属少阴" 等诊断句
  const t = simplify(text)
  const pats = [
    /(?:是|在|处在|处于|停在|已在|病在|病入|进入|属|目前是|已到|出现|呈现|显出|表现|病已成)([太阳阳明少阴厥阴]{2}、?)+[经证症病]/,
    /([太阳阳明少阴厥阴]{2})[经证症病](?:之间|阶段|死症|表证|表实|里热|里寒|寒化|热化|错杂)?/,
    /^[\s>#*-]*([太阳阳明少阴厥阴]{2})[病证]/m,
  ]
  for (const p of pats) {
    const m = t.match(p)
    if (m?.[1]) return CHANNELS.find(c => m[1]!.includes(c)) ?? null
  }
  return null
}

const samples: Sample[] = []
let id = 0

// ============ 源A: merged-table.md ============
const tableText = readFileSync('merged-table.md', 'utf8')
const lines = tableText.split('\n')
const tStart = lines.findIndex(l => l.includes('| 序号 |'))
let aHit = 0, aDrop = 0
for (let i = tStart + 1; i < lines.length; i++) {
  const l = lines[i]!
  if (!l.trim().startsWith('|') || l.includes('| --- |')) continue
  const cells = l.split('|').slice(1, -1).map(c => c.trim())
  if (cells.length < 4) continue
  const all = cells.slice(3, 12).join(' ') // 诊断+病机+西医+方剂+针灸+治法+结果+医嘱+观点
  const formulaCell = cells[6] ?? '' // slice(1,-1) 后索引偏移1：方剂列=原第7列
  const byName = formulaToLiuJing(all)
  const byFp = fingerprintToLiuJing(formulaCell)
  let label = byName ?? byFp ?? textToLiuJing(all)
  if (!label) { aDrop++; continue }
  const via = byName ? '方剂名映射' : (byFp ? '经方指纹' : '病机/正文关键词')
  const features = extractFeatures(all)
  if (features.filter(f => f > 0).length < 2) { aDrop++; continue }  // 症状充分性门槛：≥2 维，防单维弱噪声样本（如仅"头痛"）
  samples.push({id: id++, src: 'table', title: (cells[3] ?? '').slice(0, 30), features, labelName: label, via})
  aHit++
}
console.log(`[源A 1257表] 有效样本: ${aHit}  丢弃: ${aDrop}`)

// ============ 源B: 03_yian.md ============
const yianText = readFileSync(process.env.NH_YIAN_PATH ?? '03_yian.md', 'utf8')
const blocks = yianText.split(/\n(?=### )/).filter(b => b.startsWith('### '))
let bHit = 0, bDrop = 0, bMulti = 0
for (const b of blocks) {
  const title = b.match(/^### (.+)/)?.[1] ?? ''
  const ljMatch = b.match(/^\*\*六经\*\*：(.+)$/m)
  let label: string | null = null
  let via = ''
  if (ljMatch) {
    const tags = ljMatch[1]!.split(/[、，,\s]+/).map(s => s.trim()).filter(s => CHANNELS.includes(s))
    if (tags.length === 1) { label = tags[0]; via = '字段六经' }
    else if (tags.length > 1) { label = tags[0]; via = '字段六经(多取主)'; bMulti++ }
  }
  const bodyMatch = b.match(/^\*\*医案内容\*\*：\s*(.+)$/ms)
  const body = bodyMatch ? bodyMatch[1]!.trim() : ''
  const formulaLine = b.match(/^\*\*方剂\*\*：(.+)$/m)?.[1] ?? ''
  if (!label) {
    const bAll = body.slice(0, 4000)
    const byFormula = formulaToLiuJing(bAll)
    const byText = textToLiuJing(bAll)
    label = byFormula ?? byText
    via = byFormula ? '方剂映射' : (byText ? '正文关键词' : '')
    if (!label && formulaLine) { label = formulaToLiuJing(formulaLine) ?? null; via = label ? '方剂映射(行)' : '' }
  }
  if (!label) { bDrop++; continue }
  const features = extractFeatures(title, formulaLine, body.slice(0, 800))
  if (features.filter(f => f > 0).length < 2) { bDrop++; continue }  // 症状充分性门槛：≥2 维
  samples.push({id: id++, src: 'yian', title, features, labelName: label, via})
  bHit++
}
console.log(`[源B 医案集] 有效样本: ${bHit}  丢弃: ${bDrop}  多标签取主: ${bMulti}`)

// ============ 源C: 06_other.md 精选医案（59条中症状明确+六经/方剂可映射者） ============
// 标签优先级同全局：字段六经 > 方剂名映射（FORMULA_MAP）> 指纹
const OTHER_CASES: {title: string, tag?: string, formula?: string, text: string}[] = [
  {title: '06other-71-051110少阴脉倦怠', tag: '少阴', formula: '麻黄附子细辛汤', text: '长期倦怠 失眠 月经不规则 手脚冰冷 脉沉细 少阴脉'},
  {title: '06other-85-060429焦虑恐惧', tag: '厥阴', formula: '四逆汤 乌梅丸', text: '严重焦虑 恐惧 体形瘦弱 面色惨白 眼神紧张 呼吸短促 左肩左项痛'},
  {title: '06other-90-060603肾病脚肿便秘', tag: '太阳', text: '右侧肾脏极度疼痛 小便带血 双脚浮肿 便秘严重'},
  {title: '06other-93-060615真武汤头昏', formula: '真武汤', text: '头昏 吞咽食物时耳中有声 焦虑 鼻子过敏 大便有时下利有时便秘 胃口过好 身多时觉冷'},
  {title: '06other-97-060904四逆汤肾衰', formula: '四逆汤', text: '早起头昏 睡不深 身体觉冷 四肢也冷 手常冒冷汗 口渴喜温饮 倦怠无力 夜尿频数 小便次数多量少 右腰肿胀痛 脉沉细有力'},
  {title: '06other-99-060906乌梅丸便秘吐蛔', formula: '乌梅丸', text: '长期便秘 腹痛 时常从口中吐蛔虫'},
  {title: '06other-121-葛根汤外感', tag: '太阳', formula: '葛根汤', text: '头胀痛 发热 畏寒 无汗 后项到小腿肚酸痛 两髋环跳处酸疼 喉部疼痛 鼻涕倒流 六脉浮紧数'},
  {title: '06other-128-070312莱姆病双胞胎', tag: '太阳', text: '头痛 鼻塞 身体痛 恶寒 倦怠 无法集中注意力'},
  {title: '06other-132-070411ALS少阴', tag: '少阴', formula: '四逆汤 当归四逆汤', text: '右腿无法行走 无力 抽筋 双手臂逐渐无力上举 无法控制手的动作 后项强痛 背痛'},
  {title: '06other-176-五苓散头昏恶心', formula: '五苓散', text: '头昏恶心 屁股痛 针后不适'},
  {title: '06other-187-医案350骨癌四逆', formula: '四逆汤', text: '睡不好必须吃安眠药 大便时秘时下利 胃口时好时不好 无口渴人很干 喝水口干 口中异味重 双足麻皮脱落 手凉手掌皮肤干裂 骨节痛 脉缓'},
]
let cHit = 0, cDrop = 0, cMulti = 0
for (const c of OTHER_CASES) {
  let label: string | null = null
  let via = ''
  if (c.tag) {
    const tags = c.tag.split(/[、，,\s]+/).filter(s => CHANNELS.includes(s))
    if (tags.length === 1) { label = tags[0]; via = '字段六经' }
    else if (tags.length > 1) { label = tags[0]; via = '字段六经(多取主)'; cMulti++ }
  }
  if (!label) {
    const byFormula = formulaToLiuJing((c.formula ?? '') + ' ' + c.text)
    label = byFormula
    via = byFormula ? '方剂映射' : ''
  }
  if (!label) { cDrop++; continue }
  const features = extractFeatures(c.text, c.formula ?? '')
  if (features.filter(f => f > 0).length < 2) { cDrop++; continue }  // 症状充分性门槛：≥2 维
  samples.push({id: id++, src: '06other', title: c.title, features, labelName: label, via})
  cHit++
}
console.log(`[源C 06other精选] 有效样本: ${cHit}  丢弃: ${cDrop}  多标签取主: ${cMulti}`)

// ============ 汇总统计 ============
const dist: Record<string, number> = {}
const viaDist: Record<string, number> = {}
for (const s of samples) {
  dist[s.labelName] = (dist[s.labelName] ?? 0) + 1
  viaDist[s.via] = (viaDist[s.via] ?? 0) + 1
}
console.log(`\n总样本: ${samples.length}`)
console.log('标签分布:', JSON.stringify(dist))
console.log('标签来源:', JSON.stringify(viaDist))

writeFileSync(OUT, JSON.stringify({dims: DIMS.map(d => d.key), channels: CHANNELS, dataset: samples}, null, 2))
console.log(`已写入 ${OUT}`)
