# Feature: Change Management UI（变更管理界面）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §变更管理与版本控制]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 范围说明

本特性聚焦于**变更管理的 UI 层**。Working State 的核心基础设施（服务层、合并视图、发布/丢弃事务逻辑）已在 F003（object-type-crud）中实现。

本特性在 F003 提供的后端能力之上，构建用户可见的变更管理交互界面。

---

## 用户故事

作为 **本体管理员**，
我希望 **能够查看待发布变更、确认发布、查看版本历史、丢弃未发布变更**，
以便 **对本体的变更有完整的可见性和控制力**。

---

## 验收标准

### 变更状态指示
- **AC1**: 草稿与已发布版本（Published State）在 UI 有视觉区分标识（如资源列表中的状态标签）
- **AC2**: 有未发布变更时，导航栏展示变更数量徽标（badge）

### 变更预览面板
- **AC3**: 用户可以查看"待发布变更列表"——哪些资源被新增、修改、删除
- **AC4**: 变更列表每条记录显示：资源类型、资源名称、变更类型（新增/修改/删除）、变更时间

### 发布（Save / Publish）
- **AC5**: 用户点击"发布"后，调用发布 API（Working State 服务层），草稿变更被提交为一个新的版本记录
- **AC6**: 发布成功后，UI 刷新至最新已发布状态
- **AC7**: 发布操作需要二次确认弹窗

### 版本历史
- **AC8**: 用户可以查看历史版本列表（版本号、发布时间、变更摘要）
- **AC9**: 用户可以查看某个历史版本的变更详情（只读）

### 丢弃变更
- **AC10**: 用户可以丢弃当前草稿中的所有未发布变更，调用丢弃 API（Working State 服务层）
- **AC11**: 丢弃操作需要二次确认，明确提示该操作不可逆

---

## 边界情况

- **不支持**：多用户并发编辑同一草稿（MVP 单用户模型）
- **不支持**：版本回滚到任意历史版本（延后到 v0.2.0）
- **不支持**：变更审批工作流（延后到 v0.2.0）
- **不支持**：变更 diff 的字段级对比（MVP 仅展示资源级别的变更类型）
- 版本历史保留最近 50 个版本（超出时提示归档）

---

## 非功能要求

- **可用性**: 发布/丢弃操作中展示 loading 状态，防止重复提交
- **可用性**: 变更预览面板支持按资源类型筛选

---

## 相关文档

- 领域模型: [docs/architecture/02-domain-model.md §Change Management Model]
- 变更管理架构: [docs/architecture/06-change-management.md]
- Agent 上下文架构: [docs/architecture/03-agent-context-architecture.md]（Working State 对 Agent 的影响）
- 依赖特性:
  - [features/v0.1.0/003-object-type-crud]（Working State 后端基础设施）
  - [features/v0.1.0/004-app-shell]（UI 框架）
  - [features/v0.1.0/005-object-type-crud-frontend]（前端部分）
  - [features/v0.1.0/006-link-type-crud]（前端部分）
  - [features/v0.1.0/007-property-management]（前端部分）
