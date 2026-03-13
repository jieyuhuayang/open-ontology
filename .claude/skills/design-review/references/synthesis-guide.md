# Design Review Synthesis Guide

反馈合成方法论，供 SKILL.md Step 4 引用。

---

## 合成流程

### 1. 维度评分汇总

将两个评审员的 6 个维度评分汇总到评分卡中：

```
## Design Review Scorecard

| # | 维度 | Reviewer | Score | Key Finding |
|---|------|----------|-------|-------------|
| 1 | 交互流畅度 | Gemini | ?/5 | ... |
| 2 | 视觉精致度 | Codex  | ?/5 | ... |
| 3 | 情感共鸣   | Gemini | ?/5 | ... |
| 4 | 技术可行性 | Codex  | ?/5 | ... |
| 5 | 可访问性   | Gemini | ?/5 | ... |
| 6 | 设计系统一致性 | Codex | ?/5 | ... |

**Overall**: ?/30 (加权后 ?/5.0)
```

### 2. 加权评分

不同维度的权重根据项目阶段调整：

| 阶段 | 交互 | 视觉 | 情感 | 技术 | 可访问 | 一致性 |
|------|------|------|------|------|--------|--------|
| MVP / 早期 | 25% | 15% | 10% | 30% | 10% | 10% |
| 成熟期 | 20% | 20% | 15% | 15% | 15% | 15% |
| 打磨期 | 15% | 25% | 20% | 10% | 15% | 15% |

Open Ontology MVP 阶段使用第一行权重。

### 3. 共识与分歧分析

**共识信号**（两个评审员都提到的问题/优点）：
- 共识 = 高置信度，优先处理
- 列出所有共识点，标记为 `[CONSENSUS]`

**独特洞察**（仅一个评审员提到的有价值观点）：
- 标记为 `[UNIQUE-Gemini]` 或 `[UNIQUE-Codex]`
- 评估是否因为另一个评审员的维度不覆盖此方面

**矛盾处理**（两个评审员意见相反）：
- 标记为 `[CONFLICT]`
- 分析矛盾根因（通常是视角不同而非真矛盾）
- 给出推荐方向及理由

### 4. 优先级矩阵

将所有改进建议放入 2x2 矩阵：

```
         High Impact
              |
    Quick     |    Strategic
    Wins      |    Investments
              |
 Low ─────────┼───────── High
    Effort    |    Effort
              |
    Nice to   |    Defer /
    Have      |    Reconsider
              |
         Low Impact
```

- **Quick Wins** (高影响 + 低努力)：立即执行
- **Strategic Investments** (高影响 + 高努力)：规划后执行
- **Nice to Have** (低影响 + 低努力)：顺手做
- **Defer** (低影响 + 高努力)：暂缓或重新考虑

### 5. 大胆想法评估

对两个评审员的 bold ideas：
- 评估技术可行性（在当前技术栈下能否实现）
- 评估实现成本（工时估算）
- 评估对用户体验的提升幅度
- 给出建议：采纳 / 简化后采纳 / 记录待未来考虑

---

## 输出模板

最终合成报告的推荐结构：

```markdown
# Design Review Report: [设计名称]

## Scorecard
[维度评分表]

## Executive Summary
[2-3 句话总结设计当前状态和最关键的改进方向]

## Top 3 Improvements (Quick Wins)
1. [改进 1] — Source: [Gemini/Codex/Consensus], Dimension: [维度]
2. [改进 2] — ...
3. [改进 3] — ...

## Strategic Recommendations
- [需要更多投入的重要改进]

## Bold Ideas
- Gemini's bold idea: [描述] → [评估]
- Codex's bold idea: [描述] → [评估]

## Dimension Details
[按维度展开的详细反馈，仅在用户需要深入时展开]
```

---

## 注意事项

- 合成时保持中立，不偏向任何一个评审员
- 如果某个维度的评审质量明显不够（泛泛而谈），在报告中标注
- 总是以可执行的改进建议结尾，而不是抽象的评论
- 用户是最终决策者，合成报告是辅助决策的工具
