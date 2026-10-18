// build-rules-dataset.ts — 源E: formula_rules.dart（119 方结构化问诊规则，91 六经方）
// 每方: required★必选 + reference参考 + extRequired/ExtReference扩展 + differential鉴别 → 21 维特征
// 标签: meridian 字段（六经直接采用；金匮方跳过）
import {readFileSync, writeFileSync} from 'node:fs'

const OUT = 'nh-rules-dataset.json'

// —— 繁→简（与 build-all-dataset.ts 同表）——
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
  ['沈', '沉'], ['裏', '里'], ['祕', '秘'], ['甦', '苏'], ['飲', '饮'], ['顆', '颗'],
]
function simplify(text: string): string {
  let t = text
  for (const [tr, si] of SIMPLIFY) t = t.split(tr).join(si)
  return t
}

// —— 21 维症状词典（与 build-all-dataset.ts 一致）——
const DIMS = [
  {key: 'wuhan', name: '恶寒', words: ['怕冷', '恶寒', '畏寒', '很冷', '感觉冷', '觉得冷', '发冷', '冷飕飕', '怕风', '恶风', '畏冷', '怕寒', '寒战', '冷颤', '恶寒者', '微恶寒', '特别怕冷', '冷得直发抖', '怕风吹', '全身怕冷', '背恶寒', '恶寒脉微']},
  {key: 'fare', name: '发热', words: ['发热', '发烧', '觉得热', '燥热', '热症', '身热', '体温高', '怕热', '烦热', '炙热', '全身热', '身体热', '面赤热', '身大热', '蒸蒸发热', '翕翕发热', '发潮热', '日晡', '潮热', '身热疼重', '热多寒少', '发热恶寒', '身热下利', '发热微恶寒', '反发热', '蒸蒸发热']},
  {key: 'hanchu', name: '汗出', words: ['流汗', '出汗', '盗汗', '汗出', '易流汗', '汗多', '汗流不止', '出汗多', '容易出汗', '流汗多', '自汗', '大汗', '汗出者', '冒虚汗', '汗出不止', '稍微活动就出汗', '睡觉出汗', '白天也出汗', '但头汗出', '手足汗出', '大汗出', '汗出而喘', '汗漏不止', '濈然汗出', '汗出恶风', '黄汗', '汗出多']},
  {key: 'kouke', name: '口渴', words: ['口渴', '烦渴', '大渴', '想喝水', '渴', '引饮', '口干', '嘴干', '口乾', '干渴', '渴饮', '口燥渴', '欲饮水', '渴欲饮水', '口干舌燥', '想喝冰水', '渴想喝冷水', '渴想喝热水', '渴但不想喝', '消渴', '大渴', '渴而不呕', '渴欲饮水', '渴欲饮水不止', '口舌干燥', '大烦渴']},
  {key: 'kouku', name: '口苦', words: ['口苦', '口干苦', '苦味', '口臭', '口苦口干', '口苦目眩']},
  {key: 'wanglai', name: '往来寒热', words: ['往来寒热', '忽冷忽热', '寒热往来', '一阵冷一阵热', '冷热交替', '时冷时热', '如疟', '寒多热少', '往来寒热寒多', '发热恶寒如疟', '寒热一日再发']},
  {key: 'fuman', name: '腹满', words: ['腹满', '腹胀', '胀满', '肚子胀', '心下痞', '腹大', '腹部胀', '腹坚', '腹部胀满', '腹胀如鼓', '腹满者', '心下痞鞕', '腹胀满', '腹满拒按', '心下急', '腹满而吐', '心下痞满', '心下痞硬', '心下硬满', '腹胀满', '腹满大实痛', '腹满时痛', '心下满', '腹大满不通', '腹满不能食', '心下痞坚', '心下坚满', '腹满身黄', '心中痞', '心下逆满', '心下满微痛', '心下按之痛', '从心下至少腹硬满', '胸膈心下硬满', '胸中痞硬', '心腹胀满卒痛', '心下至少腹硬满剧痛', '绕脐痛', '少腹急结', '少腹硬满', '少腹满', '少腹满痛', '少腹癥块', '少腹里急', '痞满燥实', '心下痞满按之软', '腹满燥实', '少腹弦急']},
  {key: 'xiali', name: '下利', words: ['下利', '腹泻', '拉肚子', '下痢', '大便溏', '泄泻', '溏便', '水泻', '利不止', '便稀', '拉稀', '大便稀', '水样便', '溏泄', '下利清谷', '下利不止', '拉个不停', '便脓血', '大便溏', '稀拉肚子', '先硬后稀', '水样便', '便脓血', '下利清谷', '自利', '利反快', '泄利不止', '下利便脓血', '热利下重', '雷鸣下利', '利不止', '下利数十日', '完谷不化', '下利臭秽', '必自下利', '肠鸣下利', '下利未消化']},
  {key: 'jueleng', name: '厥冷', words: ['手脚冰冷', '四肢冰冷', '厥冷', '冰冷', '双脚冰冷', '手脚冷', '手脚都冷', '四肢冷', '手冷脚冷', '脚冰冷', '手足冷', '脚冷', '手冷', '四肢逆冷', '手足逆冷', '手足厥冷', '手脚冰凉', '手脚冰凉得像冰棒', '手脚冰冷到手肘', '手足寒', '手足厥寒', '厥寒', '手足冷', '手脚温热', '手心脚心热', '头热脚冷', '上半身热下半身冷', '四肢厥逆', '手足不温', '厥逆', '手足厥逆', '手足厥冷', '冷痛', '手足冷', '四肢沉重', '身重']},
  {key: 'danwumei', name: '但欲寐', words: ['嗜睡', '昏昏欲睡', '但欲寐', '想睡', '疲倦欲睡', '一直睡', '爱睡觉', '白日昏睡', '倦怠无力', '精神萎靡', '无力倦怠', '很累想睡', '但欲卧', '默默', '嗜睡睡不够', '但欲眠睡', '容易疲倦']},
  {key: 'bianmi', name: '便秘', words: ['便秘', '大便不出', '大便难', '无排便', '宿便', '大便不顺畅', '排不出', '不大便', '没有大便', '排便困难', '大便干燥', '大便干', '大便干结', '大便困难', '不排便', '大便不通', '大便硬', '大便干硬', '大便秘结', '不大便者', '大便难通', '干硬', '大便秘', '大便干结', '不大便', '便秘好几天不通', '大便硬但能通', '大便秘结', '大便不行']},
  {key: 'ou', name: '呕', words: ['呕', '恶心', '干呕', '欲呕', '吐', '反胃', '想吐', '呕吐', '呕逆', '呕者', '欲吐', '吐蛔', '呕不止', '食入即吐', '朝食暮吐', '恶心但不呕', '干呕含吐涎沫', '呕吐少量', '呕吐剧烈', '食入即吐', '朝食暮吐暮食朝吐', '噫气嗳气', '吐涎沫', '恶心呕吐', '食谷欲呕', '干噫食臭', '呕家', '水入则吐', '水入即吐', '食入口即吐', '呕吐', '食已即吐', '吐浊', '吐利', '食则吐蛔', '心中疼热']},
  {key: 'yanmu', name: '咽干目眩', words: ['咽干', '喉咙干', '目眩', '头晕', '眩晕', '眩', '头昏', '头晕目眩', '咽喉干', '目眩者', '头眩', '起则头眩', '苦冒眩', '咽中干', '头晕目眩', '目眩', '冒眩', '头眩', '目眩发落']},
  {key: 'xiongxie', name: '胸胁苦满', words: ['胸胁', '胁痛', '胁下痛', '胸胁满', '肋下', '胸满', '苦满', '胁满', '胸胁痛', '胁下痞', '胸胁苦满', '胸胁满微痛', '胸满者', '胸中气塞', '胸痹', '胸背痛', '心痛彻背', '胁下逆抢心', '胸满', '支节', '心下支结', '引胁下痛', '胸胁胀痛', '胸胁胀满', '胸满烦惊', '胸满不能卧', '胸中气塞', '胸痹喘息', '胸痛不得卧', '胁下气逆', '心中痞', '心痛彻背背痛彻心', '胸胁引痛', '胸中痞硬', '胸胁满微结', '胸胁逆满', '支节烦痛']},
  {key: 'futong', name: '腹痛', words: ['腹痛', '腹中痛', '肚子痛', '小腹痛', '腹绞痛', '喜按', '拒按', '腹满痛', '肚痛', '腹部痛', '腹中绞痛', '腹中雷鸣', '绕脐痛', '寒疝腹痛', '腹中痛', '少腹急结', '少腹满', '腹皮急', '少腹痛', '腹满时痛', '腹中隐痛', '少腹冷痛', '少腹冷急', '心悬痛', '腹痛喜按', '腹痛拒按', '腹痛阵作时止', '腹中㽲痛', '腹中寒气雷鸣切痛', '心胸中大寒痛', '胁下偏痛', '心痛彻背', '腹痛里急', '少腹满痛', '少腹里急', '时腹自痛', '腹中急痛', '腹痛', '大实痛', '绕脐痛', '腹中痛', '寒疝', '少腹弦急', '腹中痛里急', '里急后重', '脘腹痛', '心下急痛', '绞痛']},
  {key: 'shimian', name: '失眠', words: ['失眠', '无法入眠', '不易入眠', '睡不着', '睡不好', '无法睡', '不能睡', '半夜醒', '睡时醒', '无法回睡', '不好睡', '不易入睡', '入睡困难', '难入睡', '易醒', '早醒', '睡眠不好', '睡眠差', '不得眠', '不得卧', '不能合眼', '不能眠', '卧起不安', '烦躁不得眠', '不得眠', '起卧不安', '坐立难安', '烦躁欲死', '心中懊恼', '整夜睡不着', '多梦易醒', '半夜1-3点醒', '半夜3-5点醒', '心烦不得卧', '虚烦不得眠', '反复颠倒', '不能卧', '昼日烦躁夜安静', '烦惊', '谵语', '不得卧', '眠睡']},
  {key: 'xiaobian', name: '小便清长', words: ['小便清长', '小便色白', '小便白', '频尿', '夜尿', '小便不利', '无法排尿', '尿不出', '尿失禁', '小便多', '尿多', '小便频数', '小便不利者', '小便自利', '小便难', '尿不畅', '小便短赤', '小便黄', '小便微难', '小便数', '小便色白', '次数多量少', '夜尿多', '小便不利', '小便黄赤', '小便清长', '小便数', '小便微难', '夜尿频数', '尿频']},
  {key: 'maifu', name: '脉浮', words: ['脉浮', '浮脉', '浮缓', '浮紧', '脉浮数', '浮大', '脉浮缓', '脉浮紧', '脉浮滑', '脉浮虚', '脉浮者', '寸脉微浮']},
  {key: 'maida', name: '脉大', words: ['脉大', '洪大', '脉洪', '脉数大', '大脉', '洪数', '脉洪大', '洪脉', '脉大数', '脉滑']},
  {key: 'maiwei', name: '脉微细', words: ['脉微细', '微细', '脉细', '脉无力', '脉微', '脉缓无力', '微脉', '脉弱', '脉细欲绝', '脉微欲绝', '脉微弱', '脉沉者', '脉虚', '脉微细者', '脉细弱', '脉弱无力', '脉虚细', '脉结代']},
  {key: 'shehuang', name: '舌苔黄燥', words: ['舌苔黄', '黄燥', '苔黄', '舌红', '黄厚', '舌苔黄厚', '舌黄', '黄干', '苔黄干', '黄苔', '舌红苔黄', '舌苔黄干', '舌红无苔', '舌淡苔白', '舌红苔黄燥', '苔黄湿白厚', '舌淡黄', '舌黄干', '黄厚苔', '舌红少苔']},
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

// ============ 硬编码 12 问选项文本（与 formula_rules.dart qOptions 一致） ============
const Q_OPTIONS: Record<string, string[]> = {
  temperature: ['手脚温热', '手心脚心热', '往来寒热', '头热脚冷', '上半身热下半身冷', '手脚冰冷', '全身怕冷'],
  pulse: ['浮', '沉', '迟', '数', '滑', '涩', '弦', '紧', '细', '微', '弱', '缓', '不清楚', '结', '代'],
  thirst: ['不渴', '渴想喝冷水', '渴想喝热水', '渴但不想喝', '口苦口干', '消渴', '大渴'],
  sweating: ['不容易出汗', '稍微活动就出汗', '睡觉出汗', '白天也出汗', '但头汗出', '手足汗出', '大汗出'],
  pain: ['不痛', '头痛前额', '头痛两侧', '头痛后脑', '胸胁胀痛', '腹痛喜按', '腹痛拒按', '关节游走痛', '身体痛骨节痛', '心下痞满按之软', '身痒皮肤痒', '心下痞硬', '腹胀满', '身体麻木不仁', '咽中异物感', '胸痛心痛彻背', '巅顶痛', '心悸怔忡', '头晕目眩', '腰痛腰冷'],
  stool: ['正常成形', '便秘', '稀拉肚子', '先硬后稀', '水样便', '便脓血', '下利清谷', '大便色黑'],
  urine: ['正常淡黄色', '次数多量少', '次数少颜色深', '夜尿多', '小便不利', '小便黄赤', '小便清长'],
  appetite: ['正常三餐', '没有胃口', '特别能吃', '饿但不想吃', '想吃冷的', '想吃热的', '食不下', '恶心呕吐'],
  sleep: ['一觉到天亮', '半夜1-3点醒', '半夜3-5点醒', '整夜睡不着', '多梦易醒', '嗜睡睡不够'],
  energy: ['精力充沛', '容易疲倦', '但欲寐', '烦躁不安', '说话没力气', '气上撞心'],
  menstrual: ['没有此症状', '月经正常', '痛经量少色暗有块', '月经量多色红', '月经不调先后无定期', '已绝经', '性功能正常', '性功能减退腰酸'],
  vomit_type: ['恶心但不呕', '干呕含吐涎沫', '呕吐少量', '呕吐剧烈', '食入即吐', '朝食暮吐暮食朝吐', '噫气嗳气'],
}
// 扩展症状（与 formula_rules.dart extSymptoms 一致，仅保留可映射 21 维的）
const EXT_SYMPTOMS: Record<string, string> = {
  neck_stiff: '项背僵硬项背强几几',
  nape_stiff: '项强如柔痉',
  chest_oppression: '胸闷气短',
  epigastric_reverse_full: '心下逆满',
  epigastric_full_pain: '心下满微痛',
  epigastric_palpitation: '心下悸',
  umbilical_palpitation: '脐下悸',
  epigastric_hard_full: '心下硬满',
  epigastric_to_abdomen_hard: '心下至少腹硬满剧痛',
  chest_diaphragm_hard: '胸膈心下硬满',
  epigastric_press_pain: '心下按之痛',
  chest_hard_full: '胸中痞硬气上冲咽',
  epigastric_solid_full: '心下坚满',
  epigastric_hard_solid: '心下痞坚',
  epigastric_pi: '心下痞',
  lesser_abdomen_acute: '少腹急结',
  lesser_abdomen_hard: '少腹硬满',
  lesser_abdomen_full: '少腹满',
  lesser_abdomen_pain: '少腹满痛刺痛',
  lesser_abdomen_mass: '少腹癥块',
  lesser_abdomen_inner_urgent: '少腹里急',
  jaundice: '身黄如橘子色',
  jaundice_dark_forehead: '身黄额上黑',
  jaundice_dry_skin: '身黄皮肤枯燥',
  jaundice_abdominal_full: '身黄腹满',
  cough_wheeze: '咳喘喉中水鸡声',
  wheeze_no_lie: '喘咳不得卧',
  chest_full_no_lie: '胸满不能卧',
  chest_qi_block: '胸中气塞',
  chest_bi_dyspnea: '胸痹喘息咳唾短气',
  chest_no_lie: '胸痛不得卧',
  hypochondriac_qi_rise: '胁下气逆',
  heart_pi: '心中痞胁下逆抢心',
  chest_bi_fluctuate: '胸痹缓急',
  heart_pain_back: '心痛彻背背痛彻心',
  abdomen_cold_thunder: '腹中寒气雷鸣切痛',
  chest_heart_great_cold: '心胸中大寒痛',
  hypochondriac_partial_pain: '胁下偏痛',
  periumbilical_pain: '绕脐痛',
  abdomen_pain: '腹中痛里急',
  abdomen_colic: '腹痛阵作时止',
  abdomen_dull_pain: '腹中㽲痛',
  abdomen_full: '腹满',
  heart_abdomen_acute: '心腹胀满卒痛',
  liver_attachment: '胸胁痛常欲蹈其胸',
  vexing_heat: '心中懊憹胸中窒闷',
  vexing_heat_pain: '心中懊憹热痛',
  short_breath: '短气',
  body_twitch: '身瞤动',
  back_aversion_cold: '背恶寒',
  cold_hands_feet: '手足寒',
  day_vex_night_calm: '昼日烦躁夜安静',
  face_red: '面赤假热',
  body_no_aversion_face_red: '身反不恶寒面赤',
  vexed_fright: '烦惊',
  delirium: '谵语如狂',
  mania: '发狂善忘',
  sad_want_cry: '喜悲伤欲哭',
  throat_pus_blood: '咽喉不利唾脓血',
  watery_diarrhea: '泄利不止',
  hematemesis: '吐血',
  hematochezia_after: '便血先便后血',
  hematochezia_before: '便血先血后便',
  skin_rough: '肌肤甲错',
  joint_noon_worse: '关节痛日晡所剧',
  all_joints_pain: '诸肢节疼痛',
  body_emaciated: '身体尫羸',
  joint_cant_bend: '关节痛不可屈伸',
  body_pain_cant_turn: '身体疼烦不能转侧',
  tugging_pain: '掣痛不得屈伸',
  blood_qi_stab: '血气刺痛',
  retained_fluid: '留饮心下坚满利反快',
  suspended_fluid: '悬饮胸胁引痛',
  phlegm_fluid: '支饮膈间喘满痞坚',
  phlegm_fluid_dizzy: '心下有支饮冒眩',
  yellow_sweat: '黄汗脉浮汗出',
  alarm_palpitation: '惊悸',
  qi_rush_throat: '气上冲咽不得息',
  cold_hernia: '寒疝绕脐痛',
  cold_hernia_abdomen: '寒疝腹痛胁痛里急',
  limb_numb: '手足不仁',
  edema: '身重浮肿',
}

// ============ 从 formula_rules.dart 解析 allFormulaRules ============
const dart = readFileSync('formula_rules.dart', 'utf8')
const samples: Sample[] = []
let id = 0
let skipGold = 0

// 逐块解析 FormulaRule(...)
const ruleRe = /FormulaRule\(\s*name: '([^']+)',\s*meridian: '([^']+)',\s*(.*?)(?=\n  \),\n)/gs
let m: RegExpExecArray | null
let count = 0
while ((m = ruleRe.exec(dart)) !== null) {
  const name = m[1]
  const meridian = m[2]
  const body = m[3]
  if (!CHANNELS.includes(meridian)) { skipGold++; continue } // 金匮方跳过
  count++

  // 收集症状文本
  const symTexts: string[] = []

  // required / reference: {kQ1: [1], kQ4: [2, 4], ...}
  const optRe = /\{\s*([^}]+)\}/g
  let om: RegExpExecArray | null
  while ((om = optRe.exec(body)) !== null) {
    const seg = om[1]
    const qRe = /kQ(\d+):\s*\[([\d,\s]+)\]/g
    let qm: RegExpExecArray | null
    while ((qm = qRe.exec(seg)) !== null) {
      const qNum = parseInt(qm[1])
      const qKey = ['', 'temperature', 'pulse', 'thirst', 'sweating', 'pain', 'stool', 'urine', 'appetite', 'sleep', 'energy', 'menstrual', 'vomit_type'][qNum]
      const opts = qm[2].split(',').map(x => parseInt(x.trim()))
      for (const o of opts) {
        const text = Q_OPTIONS[qKey]?.[o - 1]
        if (text && !['不渴', '不痛', '正常成形', '正常淡黄色', '正常三餐', '一觉到天亮', '精力充沛', '没有此症状', '月经正常', '已绝经', '性功能正常', '不清楚'].includes(text)) {
          symTexts.push(text)
        }
      }
    }
  }

  // extRequired / extReference: {'neck_stiff', 'jaundice'}
  const extRe = /'([a-z_]+)'/g
  // 只取 ext 块（在 body 里含 extRequired/extReference 的部分）
  const extBlockRe = /ext(?:Required|Reference):\s*\{([^}]*)\}/g
  let em: RegExpExecArray | null
  while ((em = extBlockRe.exec(body)) !== null) {
    const keys = em[1].match(/'([a-z_]+)'/g) ?? []
    for (const k of keys) {
      const key = k.replace(/'/g, '')
      if (EXT_SYMPTOMS[key]) symTexts.push(EXT_SYMPTOMS[key])
    }
  }

  // differential 文本
  const diff = body.match(/differential: '([^']+)'/)?.[1] ?? ''
  symTexts.push(diff)

  const features = extractFeatures(symTexts.join(' '))
  if (features.every(x => x === 0)) { skipGold++; continue }
  samples.push({id: id++, src: 'rules', title: name, features, labelName: meridian, via: '问诊规则'})
}

// ============ 源F: diagnostic_engine.dart 规则（v15 实验：已评估——评测持平但个案回归，
// 规则改存知识库 modules/04_jin_gui_rules.md，不并入网络训练，防止权重漂移） ============
// ENGINE_RULES 16 条实验结论（2026-10-17）：
//  加入后评测 63.6% 与 v14c 持平，但个案回归：阳痿案少阴41%→阳明44%（错误）、
//  脚肿案少阴37%→太阳29%、月经案少阳37%→厥阴32%。网络层保持 v14c 行为。

const dist: Record<string, number> = {}
for (const s of samples) dist[s.labelName] = (dist[s.labelName] ?? 0) + 1
const nz = samples.map(s => s.features.filter(x => x > 0).length)
const avgNz = nz.length ? (nz.reduce((a, b) => a + b, 0) / nz.length).toFixed(2) : '0'
console.log(`解析到 ${count} 个六经方规则，产出 ${samples.length} 条样本（跳过 ${skipGold}：金匮/零特征）`)
console.log('标签分布:', JSON.stringify(dist))
console.log(`平均非零维度: ${avgNz}`)
writeFileSync(OUT, JSON.stringify({dims: DIMS.map(d => d.key), channels: CHANNELS, dataset: samples}, null, 2))
console.log(`已写入 ${OUT}`)
