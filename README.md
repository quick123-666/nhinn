# NHINN · Ni Haixia Interpretable Neural Network

倪海厦可解释神经网络 · 六经辨证引擎

*Six-Meridian Diagnosis with Interpretable Weights*

用**可微电路神经网络**（[Handwired](https://github.com/chenglou/handwired)）训练**六经辨证**：输入症状文本 → 33 维症状特征 → 6 经（太阳/阳明/少阳/太阴/少阴/厥阴）概率分布 → 推荐经方，并自动检索倪海厦真实医案做证据增强（医案直证）。网络学出的 **198 个权重可解释**（与《伤寒论》六经提纲对照可视化），不是黑箱。

## 快速开始

需要 [bun](https://bun.sh)（v1.x）。

```bash
# 推理：症状文本 → 六经概率 + 推荐方剂 + 医案直证
bun nh-predict.ts "怕冷 没汗 头痛 身痛 脉浮紧"

# 评测：22 例独立评测集（留出 11 + 新案例 11）
bun nh-eval.ts

# 重训（483 条：医案 216 + 方证 168 + 规则 89）
bun nh-liujing-21.ts
```

## 核心文件

| 文件 | 作用 |
|---|---|
| `nh-engine.ts` | 共享推理引擎：33 维症状词典（含繁→简）+ 特征提取 + softmax 预测 |
| `nh-predict.ts` | 推理入口：症状文字 → 六经概率条 + 推荐方剂 + 医案直证（1302 条索引） |
| `nh-liujing-21.ts` | 训练主脚本：两阶段训练（提纲锚点 + 医案/方证/规则混合微调） |
| `trainable.ts` | 训练脚手架（trainSoftmax：gradientScaleLimit / Adam / weightDecay / labelSmoothing） |
| `nh-eval.ts` | 独立评测：分经准确率 / 混淆矩阵 / Top2 / 分布内外 / 纠缠分析 |
| `build-*.ts` | 数据集构建（医案 / 方证 / 规则 / 评测集 / 医案索引） |
| `modules/` | 知识库：04 金匮方证速查（145 条）、05 诊断规则（21 合病 + 30 鉴别 + 22 加减）、06 方剂口服用意（60+ 方） |
| `nh-weights.json` | v17 学出权重（198 权重 + 6 阈值） |

## 33 维症状

恶寒 发热 汗出 口渴 口苦 往来寒热 腹满 下利 厥冷 但欲寐 便秘 呕 咽干目眩 胸胁苦满 腹痛 失眠 小便清长 脉浮 脉大 脉微细 舌苔黄燥 脉弦 脉沉 脉迟 脉紧 脉数 头痛 身痛 胃口 咳嗽 水肿 月经 性功能

## 训练数据与来源

- 医案 216 条：`jangviktor-web/nihaixia`（1257 例结构化表清洗 151 条 + 03_yian 医案 64 条 + 06_other 精选 10 条）
- 方证 168 条：`jangviktor-web/nihaixia-app`（formulas.json meridian 字段 + 口语方证）
- 规则 89 条：`jangviktor-web/nihaixia-app`（formula_rules.dart 问诊规则）
- 医案直证索引 1302 条：1257 例表 + 03_yian 叙事医案
- 知识库 04/05/06：`nihaixia-app` diagnostic_engine.dart / diagnostic_rules.dart / formula_oral_hints.json 提炼

数据文件随仓库发布（便于复现）；如需重建，请自行从上述源仓库获取原始数据（`merged-table.md`、`03_yian.md` 等），并通过环境变量 `NH_YIAN_PATH` 指定医案路径。

## 评测基线（v17）

- 总体 63.6%（14/22），Top2 81.8%（18/22），留出（分布内）64%
- 分经：太阳 67% / 阳明 67% / 少阳 100% / 少阴 63% / 厥阴 0%（样本少）
- 已知纠缠：太阳↔阳明（2+2 例）、少阴↔厥阴（2 例）——源于《伤寒论》经方原文真实交叠，靠问诊流程 B 边界追问兜底

## 免责声明

本项目的辨证结果基于倪海厦公开医案/讲义整理与神经网络学习，**仅作经方学习与研究参考，不构成医疗建议**。疾病诊治请咨询执业医师。

## License

MIT（数据与医案内容版权归原作者/源仓库所有，使用时请遵守其许可）。
