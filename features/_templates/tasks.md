# Tasks: <特性名称>

**关联规格**: [spec.md](./spec.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | 🔲 草稿 | 用户确认后改为 ✅ 已评审（唯一手动暂停点） |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | X / N 完成 |

---

## 开发模式

**Test-First（奇数=测试，偶数=实现）**：先写测试（红），再写实现（绿）。
基础设施任务（数据库迁移、ORM 模型、配置）无测试配对，单独编号。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### 基础设施

- [ ] **T001**: <数据库迁移 / ORM 模型 / 配置>
  **文件**: `apps/server/alembic/versions/NNN_xxx.py`
  **逻辑**: <具体要做什么，如创建哪些表、哪些字段>
  **依赖**: 无

### 后端服务层

- [ ] **T002**: <模块>单元测试
  **文件**: `apps/server/tests/unit/test_xxx_service.py`
  **逻辑**: 测试 <ServiceName> 的核心方法
  **测试**: `test_xxx_success` → AC-01, `test_xxx_not_found` → AC-02, `test_xxx_conflict` → AC-03
  **覆盖 AC**: AC-01, AC-02, AC-03
  **依赖**: T001

- [ ] **T003**: <模块>服务层实现
  **文件**: `apps/server/app/services/xxx_service.py`
  **逻辑**: <具体业务逻辑描述，如调用哪些 storage 方法、校验哪些不变量>
  **测试**: T002 全部通过
  **覆盖 AC**: AC-01, AC-02, AC-03
  **依赖**: T001

### 后端 API 层

- [ ] **T004**: API 路由集成测试
  **文件**: `apps/server/tests/integration/test_xxx_router.py`
  **逻辑**: 测试 HTTP 端点的请求/响应
  **测试**: `test_create_xxx_success` → AC-01, `test_get_xxx_not_found` → AC-02
  **覆盖 AC**: AC-01, AC-02, AC-03
  **依赖**: T003

- [ ] **T005**: API 路由实现
  **文件**: `apps/server/app/routers/xxx.py`
  **逻辑**: <HTTP 解析 + 委托给 service，如 POST /api/v1/xxx → service.create()>
  **测试**: T004 全部通过
  **覆盖 AC**: AC-01, AC-02, AC-03
  **依赖**: T003

### 前端

- [ ] **T006**: 前端组件测试
  **文件**: `apps/web/src/pages/<Resource>Page/__tests__/`
  **逻辑**: 测试组件渲染和交互
  **测试**: `renders list correctly` → AC-01, `shows error state` → AC-02
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T005（API 已实现）

- [ ] **T007**: 前端页面实现
  **文件**: `apps/web/src/pages/<Resource>Page/index.tsx`
  **逻辑**: <组件结构、数据获取方式、用户交互流程>
  **测试**: T006 全部通过
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T005

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- **偏差 1**: <描述实际做了什么，以及为何偏离原计划>
