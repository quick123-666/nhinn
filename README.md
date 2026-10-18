<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License">
  <img src="https://img.shields.io/badge/runtime-bun-black.svg" alt="Bun">
  <img src="https://img.shields.io/badge/33-dim-symptoms-green.svg" alt="33 dims">
  <img src="https://img.shields.io/badge/483-samples-orange.svg" alt="483 samples">
  <img src="https://img.shields.io/badge/eval-63.6%25-purple.svg" alt="Eval 63.6%">
  <img src="https://img.shields.io/badge/Top2-81.8%25-teal.svg" alt="Top2 81.8%">
</p>

<h1 align="center">NHINN</h1>
<h3 align="center">Ni Haixia Interpretable Neural Network</h3>
<p align="center"><b>倪海厦可解释神经网络 · 六经辨证引擎</b></p>
<p align="center"><i>Six-Meridian Diagnosis with Interpretable Weights</i></p>

<p align="center">
  用 <b>可微电路神经网络</b>（<a href="https://github.com/chenglou/handwired">Handwired</a>）训练 <b>六经辨证</b>——输入症状文本，输出六经概率与推荐经方，并自动检索倪海厦真实医案作为证据增强。
  网络学出的 <b>198 个权重完全可解释</b>，与《伤寒论》六经提纲对齐可视化，不是黑箱。
</p>

---

## ✨ 核心亮点

| | 特性 | 说明 |
|---|---|---|
| 🧠 | **可解释权重** | 198 个学出权重可对照《伤寒论》提纲逐条验证（如少阴经对「但欲寐/厥冷/脉微细」学出 +0.47/+0.56/+0.38） |
| 📖 | **33 维症状特征** | 恶寒/发热/汗出/口渴/口苦/往来寒热/腹满/下利/厥冷/但欲寐/便秘/呕/咽干目眩/胸胁苦满/腹痛/失眠/小便清长/脉浮/脉大/脉微细/舌苔黄燥/脉弦/脉沉/脉迟/脉紧/脉数/头痛/身痛/胃口/咳嗽/水肿/月经/性功能 |
| 🔍 | **医案直证** | 1302 条倪师真实医案索引，症状词重叠 ≥2 自动附真实处方（证据增强，非凭空开方） |
| ⚕️ | **知识库交叉印证** | 三模块知识库（金匮方证 145 条 / 诊断规则 21 合病 + 30 鉴别 / 方剂口服用意 60+ 方）做二次核对 |
| 🏗️ | **两阶段训练** | 阶段1 提纲 6 案学仲景结构 → 阶段2 医案 + 方证 + 规则混合微调（少阴锚点防稀疏维度漂移） |

---

## 🚀 快速开始

需要 [bun](https://bun.sh)（v1.x）。

```bash
# 推理：症状文本 → 六经概率 + 推荐方剂 + 医案直证
bun nh-predict.ts "怕冷 没汗 头痛 身痛 脉浮紧"
```

**示例输出：**

```
══════ 六经辨证 · v17（483 条）══════
输入症状: 怕冷 没汗 头痛 身痛 脉浮紧
命中维度: 恶寒、脉浮、脉紧、头痛、身痛

各经评分:
  太阳     2.44    78.6%  ████████████████  ← 辨证
  少阴    -1.58     1.4%
  ...

═══ 辨证结论: 太阳病（恶寒发热脉浮）═══
推荐方剂: 桂枝汤/麻黄汤（有汗→桂枝，无汗→麻黄）

── 医案直证（命中 3 个倪师真实医案）──
  Mxxx·xxx   诊断: xxx  重叠: 恶寒、脉浮、头痛  方剂: 麻黄汤
```

---

## 🧭 架构流程

```
症状文本 ──→ 33维症状词典（繁→简归一） ──→ 特征向量
                                              │
                                              ▼
                    可微电路神经网络（198 可解释权重 + 6 阈值）
                                              │
                                              ▼
                    softmax → 六经概率分布（太阳/阳明/少阳/太阴/少阴/厥阴）
                                              │
                          ┌───────────────────┴───────────────────┐
                          ▼                                       ▼
              推荐经方（方证映射）                   医案直证（1302条索引检索）
                          │                                       │
                          └───────────► 知识库交叉印证（modules/）◄─┘
```

---

## 📊 数据与评测

### 训练数据（v17 · 483 条）

| 来源 | 数量 | 说明 |
|---|---|---|
| 医案 | 216 | 1257 例表清洗 151 + 03_yian 医案 64 + 06_other 精选 10 |
| 方证 | 168 | nihaixia-app formulas.json（meridian 字段 + 口语方证） |
| 规则 | 89 | formula_rules.dart 问诊规则 |
| 医案索引 | 1302 | 1257 例表 + 叙事医案（推理直证用） |

### 独立评测（22 例：留出 11 + 新案例 11）

| 指标 | 结果 |
|---|---|
| 总体准确率 | **63.6%**（14/22） |
| Top2 命中 | **81.8%**（18/22） |
| 留出（分布内） | 64%（7/11） |
| 分经 | 太阳 67% / 阳明 67% / 少阳 100% / 少阴 63% |

> ⚠️ **已知纠缠**：太阳↔阳明、少阴↔厥阴 边界案会漂移——源于《伤寒论》经方原文的真实交叠（如理中汤霍乱证与麻黄汤证均见头痛身痛脉紧），设计上用问诊流程 B 的边界追问兜底，而非强行抹平。

---

## 🛠️ 命令速查

```bash
bun nh-predict.ts "症状文本"     # 推理（核心入口）
bun nh-eval.ts                   # 独立评测（报告自动写 nh-eval-report.txt）
bun nh-liujing-21.ts             # 重训（两阶段）
bun build-all-dataset.ts         # 重建医案数据集
bun build-hints-dataset.ts       # 重建方证数据集
bun build-rules-dataset.ts       # 重建规则数据集
bun build-eval-dataset.ts        # 重建评测集（固定 seed 20261017）
bun build-case-index-v2.ts       # 重建医案直证索引
```

---

## 📁 项目结构

```
nhinn/
├── nh-engine.ts            # 共享推理引擎（33维词典 + 繁简 + 特征 + softmax）
├── nh-predict.ts           # 推理入口（含医案直证检索）
├── nh-liujing-21.ts        # 训练主脚本（两阶段：提纲锚点 + 混合微调）
├── trainable.ts            # 训练脚手架（Adam / weightDecay / labelSmoothing）
├── nh-eval.ts              # 独立评测（分经 / 混淆矩阵 / Top2 / 纠缠分析）
├── build-*.ts              # 数据集构建（医案 / 方证 / 规则 / 评测 / 索引）
├── nh-weights.json         # v17 学出权重（198 + 6）
├── nh-case-index.json      # 1302 条医案直证索引
├── modules/
│   ├── 04_jin_gui_rules.md # 金匮方证速查（145 条）
│   ├── 05_diagnostic_rules.md # 诊断规则（21 合病 + 30 鉴别 + 22 加减 + 优化十问）
│   └── 06_oral_hints.md    # 方剂口服用意（60+ 方患者口语→辨证指针）
└── README.md
```

---

## 📚 数据来源

- `jangviktor-web/nihaixia`（1257 例结构化医案表 + 叙事医案）
- `jangviktor-web/nihaixia-app`（formulas.json / formula_rules.dart / diagnostic_engine.dart / diagnostic_rules.dart / formula_oral_hints.json）

如需重建数据，请从上述仓库获取原始数据（`merged-table.md`、`03_yian.md` 等），医案路径通过环境变量 `NH_YIAN_PATH` 指定。

---

## ⚠️ 免责声明

本项目的辨证结果基于倪海厦公开医案与讲义整理、经神经网络学习所得，**仅作经方学习与研究参考，不构成医疗建议**。疾病诊治请咨询执业医师。

## License

MIT。医案与条文内容版权归原作者/源仓库所有，使用时请遵守其许可。
