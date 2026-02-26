# Tasks: <特性名称>

**关联规范**: [spec.md](./spec.md)
**技术方案**: [plan.md](./plan.md)
**版本**: v0.1.0
**开始日期**: YYYY-MM-DD
**完成日期**: -

---

## 进度概览

- 总任务数: N
- 已完成: 0 / N
- 状态: 🔲 未开始 / 🔄 进行中 / ✅ 完成

---

## Tasks

### 后端

- [ ] **T01**: <任务描述>
  - 文件: `apps/server/path/to/file.py`
  - 内容: <简要说明要做什么，引用 plan.md 章节>
  - 依赖: 无

- [ ] **T02**: <任务描述>
  - 文件: `apps/server/path/to/another_file.py`
  - 内容: 见 [plan.md §数据结构](./plan.md#数据结构)
  - 依赖: T01

- [ ] **T03**: <任务描述>
  - 文件: `apps/server/path/to/router.py`
  - 内容: 见 [plan.md §API 定义](./plan.md#api-定义)
  - 依赖: T02

### 前端

- [ ] **T04**: <任务描述>
  - 文件: `apps/web/src/api/<resource>.ts`
  - 内容: API 客户端函数，对应 plan.md 中的端点定义
  - 依赖: T03（API 端点已实现）

- [ ] **T05**: <任务描述>
  - 文件: `apps/web/src/pages/<Resource>Page/index.tsx`
  - 内容: 见 [plan.md §前端组件](./plan.md#前端组件)
  - 依赖: T04

### 测试

- [ ] **T06**: 编写后端集成测试
  - 文件: `apps/server/tests/test_<resource>.py`
  - 内容: 覆盖 spec.md 中的所有验收标准
  - 依赖: T03

- [ ] **T07**: 编写前端组件测试
  - 文件: `apps/web/src/pages/<Resource>Page/__tests__/`
  - 内容: 表单验证、列表渲染、错误状态
  - 依赖: T05

---

## 实际偏差记录

> 完成后，在此记录实现与 plan.md 的偏差，供后续参考。

- **偏差 1**: <描述实际做了什么，以及为何偏离原计划>

---

## 会话记录

> 每次 AI 协作会话完成哪些 tasks，可简要记录。

| 日期 | 完成任务 | 备注 |
|------|---------|------|
| YYYY-MM-DD | T01, T02 | - |
