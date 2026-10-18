// trainable.ts — Handwired 可训练分类器脚手架（softmax 交叉熵 + Adam）
//
// 沉淀自六经辨证网络构建工作（nh-liujing.ts），把踩过的坑固化成可复用训练层：
//   1. 输入 cell 必须显式 declare —— 漏声明时 source[undefined] 静默失败，梯度恒 0
//   2. affine 系数是构建期常量 —— 反向只传 og×系数，不会乘输入值；
//      可训练"权重×输入"必须用 circuit.multiply(wCell, inputCell)（乘法操作反向会乘对侧值）
//   3. 单次 evaluateReference 即可取全部 logits —— 避免每样本两次前向
//   4. 官方 trainStep 实践：weightDecay 正则 + gradientScaleLimit 梯度裁剪 + clamp
//
// 用法（见 nh-liujing.ts）：
//   trainSoftmax({evaluateReference, backpropagateReference}, validate, source,
//     logits, inputCells, params, dataset, {steps, lr, weightDecay, logEvery, onProgress})

export interface TrainableParam {
  wire: number // 可训练 cell 的 wire 索引
  min: number // clamp 下界
  max: number // clamp 上界
}

export interface ClassifierTrainOptions {
  steps: number
  lr: number
  weightDecay?: number
  logEvery?: number
  onProgress?: (step: number, loss: number) => void
  labelSmoothing?: number // ε，目标 = (1-ε)onehot + ε/K，抑制冲突样本拉扯（默认 0）
}

interface Net {
  evaluateReference(source: Float32Array): Float32Array
  backpropagateReference(values: Float32Array, outputGradients: Float32Array): Float32Array
}

export interface Sample {
  features: number[] // 按 inputCells 顺序的输入值
  label: number // 类别索引
  weight?: number // 样本权重（默认 1，用于强化先验/平衡类别）
}

function softmax(s: number[]): number[] {
  const m = Math.max(...s)
  const e = s.map(x => Math.exp(x - m))
  const sum = e.reduce((a, b) => a + b, 0)
  return e.map(x => x / sum)
}

function setInput(source: Float32Array, inputCells: number[], features: number[]) {
  for (let i = 0; i < inputCells.length; i++) source[inputCells[i]!] = features[i]!
}

/** 训练一个 softmax 交叉熵分类器；logits 为各类别得分 wire，params 为全部可训练参数。 */
export function trainSoftmax(
  net: Net,
  validate: (source: Float32Array) => void,
  source: Float32Array,
  logits: number[],
  inputCells: number[],
  params: TrainableParam[],
  dataset: Sample[],
  opts: ClassifierTrainOptions,
): {loss: () => number} {
  const {steps, lr, weightDecay = 0, logEvery = 50, onProgress, labelSmoothing = 0} = opts
  const n = params.length
  const classCount = logits.length
  const m1 = new Float32Array(n)
  const m2 = new Float32Array(n)
  const totalW = dataset.reduce((a, d) => a + (d.weight ?? 1), 0)

  const loss = (): number => {
    let s = 0
    for (const d of dataset) {
      setInput(source, inputCells, d.features)
      validate(source)
      const v = net.evaluateReference(source)
      const p = softmax(logits.map(w => v[w]!))
      s -= (d.weight ?? 1) * Math.log(Math.max(p[d.label]!, 1e-9))
    }
    return s / totalW
  }

  for (let step = 1; step <= steps; step++) {
    const grad = new Float32Array(n)
    for (const d of dataset) {
      setInput(source, inputCells, d.features)
      validate(source)
      const v = net.evaluateReference(source) // 单次前向，logits 直接从 values 取
      const p = softmax(logits.map(w => v[w]!))
      const og = new Float32Array(v.length)
      const eps = labelSmoothing
      for (let i = 0; i < classCount; i++) {
        const target = (i === d.label ? 1 - eps : 0) + eps / classCount // 平滑目标
        og[logits[i]!] = p[i]! - target
      }
      const g = net.backpropagateReference(v, og)
      const w = d.weight ?? 1
      for (let i = 0; i < n; i++) grad[i] = Math.fround(grad[i]! + g[params[i]!.wire]! * w)
    }
    // 平均 + L2 正则 + 全局梯度缩放（官方 trainStep 同款）
    let magnitude = 0
    for (let i = 0; i < n; i++) {
      grad[i] = Math.fround(grad[i]! / totalW + source[params[i]!.wire]! * weightDecay)
      magnitude += grad[i]! * grad[i]!
    }
    const scale = Math.min(1, 1 / Math.sqrt(magnitude))
    for (let i = 0; i < n; i++) {
      const gradient = grad[i]! * scale
      m1[i] = Math.fround(0.9 * m1[i]! + 0.1 * gradient)
      m2[i] = Math.fround(0.999 * m2[i]! + 0.001 * gradient * gradient)
      const c1 = 1 - 0.9 ** step
      const c2 = 1 - 0.999 ** step
      const update = lr * (m1[i]! / c1) / (Math.sqrt(m2[i]! / c2) + 1e-8)
      const p = params[i]!
      source[p.wire] = Math.fround(Math.max(p.min, Math.min(p.max, source[p.wire]! - update)))
    }
    if (step % logEvery === 0 || step === steps) onProgress?.(step, loss())
  }
  return {loss}
}
