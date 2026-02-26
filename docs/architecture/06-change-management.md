# 06 - Change Management / 变更管理

## Overview

变更管理确保本体 schema 的所有修改都是可追溯、可回滚、可协作的。

数据结构定义见 [02-domain-model.md](./02-domain-model.md) Change Management Model 章节（`WorkingState`、`Change`、`ChangeRecord`）。资源标识命名约定见同文档的 Naming Convention 章节。

---

## 1. Change Lifecycle / 变更生命周期

### 状态机

```
Edit → Working State → Save → Published
                    → Discard (删除 WorkingState)
```

### 详细流程

1. **用户编辑触发** → 创建/更新 WorkingState（基于当前 `ontology.version`）
2. **每次编辑操作** → 追加 `Change` 记录到 `WorkingState.changes[]`
3. **Save 操作** → 验证 → 冲突检测 → 原子写入 → 版本号 +1
4. **Discard** → 删除该 WorkingState

---

## 2. Working State Management / 工作状态管理

- 每个用户对每个 Ontology 最多一个 WorkingState（`UNIQUE(user_id, ontology_rid)`）
- WorkingState 记录 `baseVersion`（创建时的 `ontology.version`）
- 前端定期自动保存 WorkingState 到后端（不是 Save/发布，是持久化草稿）
- WorkingState 有过期策略：超过 7 天未更新 → 标记为 stale，提示用户

---

## 3. Save Operation / 保存操作

### 3.1 验证

- 所有变更必须满足 Domain Rules（[02-domain-model.md](./02-domain-model.md)）
- 校验失败 → 拒绝保存，返回错误列表

### 3.2 冲突检测

- **条件**：`WorkingState.baseVersion < ontology.version`（期间有其他用户发布了变更）
- **检测粒度**：资源级别（相同 `resourceRid` 被不同用户修改）
- **无冲突**（不同资源）→ 自动 rebase（更新 baseVersion，保留变更）
- **有冲突**（相同资源）→ 返回冲突详情，用户选择：
  - **覆盖（overwrite）**：以我的变更为准
  - **放弃（discard mine）**：丢弃我的冲突变更，保留其他非冲突变更
  - **手动合并（manual）**：MVP 不支持字段级合并，留作 post-MVP

### 3.3 原子写入

单个数据库事务内完成：

1. 应用所有 Changes 到主表（`object_types`, `properties`, `link_types`）
2. 创建 `ChangeRecord`（含 version, changes, savedBy）
3. 递增 `ontology.version`
4. 删除该 WorkingState

任何步骤失败 → 整个事务回滚。

---

## 4. Version Numbering / 版本号

- `ontology.version`: 单调递增整数，每次 Save +1
- `ChangeRecord.version` 与 `ontology.version` 一一对应
- 支持通过 version 查询任意历史时刻的变更记录

---

## 5. History and Rollback / 历史与回滚

- **查看历史**：按 version 降序展示 ChangeRecord 列表
- **查看某次变更详情**：展示 `changes[]` 的 before/after diff
- **回滚**：创建一组新的"逆向 Changes"（DELETE↔CREATE，UPDATE 的 before/after 互换），走正常 Save 流程
- 回滚本身也是一次新版本，而非"时间旅行"

---

## 6. API Endpoints / API 端点

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ontologies/{rid}/working-state` | 获取当前用户的工作状态 |
| `PUT` | `/api/ontologies/{rid}/working-state` | 更新工作状态（前端自动保存） |
| `POST` | `/api/ontologies/{rid}/save` | 保存（发布）变更 |
| `DELETE` | `/api/ontologies/{rid}/working-state` | 丢弃工作状态 |
| `GET` | `/api/ontologies/{rid}/history` | 变更历史列表 |
| `GET` | `/api/ontologies/{rid}/history/{version}` | 某版本变更详情 |
| `POST` | `/api/ontologies/{rid}/rollback/{version}` | 回滚到某版本 |

---

## Data Model Reference

数据结构定义见 [02-domain-model.md](./02-domain-model.md) Change Management Model 章节。
