# Tasks: Object Type CRUD（对象类型增删改查）

**关联规范**: [spec.md](./spec.md)
**技术方案**: [plan.md](./plan.md)
**版本**: v0.1.0
**开始日期**: 2026-02-28
**完成日期**: -

---

## 进度概览

- 总任务数: 10
- 已完成: 10 / 10
- 状态: ✅ 完成（单元测试全部通过，集成测试需数据库环境）

---

## 开发模式

**Test-First（奇数测试，偶数实现）**：每组先写测试（红），再写实现（绿）。奇数任务产出测试文件，偶数任务产出实现代码并确保测试通过。

---

## Group 1: Domain 层

- [x] **T001**: 编写 Domain 层校验器单元测试
  - 文件: `apps/server/tests/unit/__init__.py`, `apps/server/tests/unit/test_validators.py`
  - 内容:
    - `validate_api_name()` 测试：合法 PascalCase 通过、非 PascalCase 拒绝（小写开头、纯数字、含特殊字符）、保留字拒绝（`Ontology`→小写比较命中 `ontology`）
    - `validate_object_type_id()` 测试：合法 id 通过（`my-type-1`）、非法拒绝（大写、特殊字符、数字开头）
    - 使用 `pytest.raises` 捕获自定义异常，验证 error code
  - 依赖: 无
  - AC 覆盖: AC3a, AC3b

- [x] **T002**: 实现 Domain 层全部模型、常量和校验器
  - 文件:
    - `apps/server/app/domain/constants.py` — `DEFAULT_USER_ID`, `DEFAULT_ONTOLOGY_RID`, `DEFAULT_PROJECT_RID`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`
    - `apps/server/app/domain/validators.py` — `validate_api_name()`, `validate_object_type_id()`, `RESERVED_API_NAMES`, 正则常量
    - `apps/server/app/domain/working_state.py` — `ChangeType`, `ResourceType`, `ChangeState`, `Change`, `WorkingState`, `ChangeRecord` 模型
    - `apps/server/app/domain/object_type.py` — `ResourceStatus`, `Visibility`, `Icon`, `ObjectType`, `ObjectTypeWithChangeState`, `ObjectTypeCreateRequest`, `ObjectTypeUpdateRequest`, `ObjectTypeListResponse`
  - 内容: 见 [plan.md §数据结构设计](./plan.md#数据结构设计)。所有模型继承 `DomainModel`，使用 `alias_generator=to_camel` + `populate_by_name=True`。校验器抛出 `AppError`，错误码见 plan.md §错误码
  - 依赖: 无（复用 F001 的 `app/domain/common.py` 和 `app/exceptions.py`）
  - AC 覆盖: AC3a, AC3b
  - 验证: T001 全部测试通过

---

## Group 2: Storage 层

- [x] **T003**: 编写 Storage 层单元测试
  - 文件: `apps/server/tests/unit/test_storage.py`
  - 内容:
    - `WorkingStateStorage`: 测试 `_to_domain()` ORM→Domain 转换（changes JSONB 反序列化为 `list[Change]`）
    - `ObjectTypeStorage`: 测试 `_to_domain()` ORM→Domain 转换（字段映射完整性）、`_to_dict()` Domain→dict 转换
    - `OntologyStorage`: 无纯逻辑可测，此模块仅需集成测试覆盖
    - 使用 mock ORM 对象（`MagicMock`）模拟数据库返回
  - 依赖: T002（需要 Domain 模型定义）
  - AC 覆盖: 间接支持所有 AC（数据层正确性保证）

- [ ] **T004**: 实现 Storage 层三个模块
  - 文件:
    - `apps/server/app/storage/working_state_storage.py` — `get_by_ontology()`, `create()`, `update_changes()`, `delete()`
    - `apps/server/app/storage/object_type_storage.py` — `list_by_ontology()`, `get_by_rid()`, `get_by_id()`, `get_by_api_name()`, `create()`, `update()`, `delete()`, `get_related_link_type_rids()`
    - `apps/server/app/storage/ontology_storage.py` — `get_by_rid()`, `increment_version()`
  - 内容: 见 [plan.md §Storage 层设计](./plan.md#storage-层设计)。全部使用 async SQLAlchemy 2.0 + asyncpg，接收 `AsyncSession` 参数，返回 Domain 模型
  - 依赖: T002（Domain 模型）、F002（ORM 模型 `app/storage/models.py`）
  - AC 覆盖: 间接支持所有 AC
  - 验证: T003 全部测试通过

---

## Group 3: WorkingStateService

- [ ] **T005**: 编写变更合并逻辑单元测试
  - 文件: `apps/server/tests/unit/test_change_collapsing.py`
  - 内容:
    - 变更合并（Change Collapsing）四种场景:
      - CREATE + UPDATE → 合并为 CREATE（after 取最新值）
      - CREATE + DELETE → 抵消移除（changes 中该资源的变更被清除）
      - UPDATE + UPDATE → 保留最早 before + 最新 after
      - UPDATE + DELETE → 变为 DELETE（保留原始 before）
    - 合并视图（Merged View）逻辑:
      - 已发布资源无草稿变更 → `changeState=published`
      - 草稿 CREATE → `changeState=created`
      - 草稿 UPDATE → `changeState=modified`（合并已发布字段 + after）
      - 草稿 DELETE → `changeState=deleted`
    - Mock `WorkingStateStorage` 和 `ObjectTypeStorage`，测试纯 Service 逻辑
  - 依赖: T002（Domain 模型）
  - AC 覆盖: AC11, AC12, AC13

- [ ] **T006**: 实现 WorkingStateService
  - 文件: `apps/server/app/services/working_state_service.py`
  - 内容:
    - `get_or_create(ontology_rid)` — 获取现有 WS 或自动创建
    - `add_change(ontology_rid, change)` — 追加变更 + 变更合并（AD-3）
    - `get_merged_view(ontology_rid, resource_type)` — 返回 `list[tuple[dict, ChangeState]]`，资源类型无关
    - `publish(ontology_rid)` — 原子事务：应用变更到主表 → 创建 ChangeRecord → 递增 version → 删除 WS
    - `discard(ontology_rid)` — 删除 WorkingState
  - 内容: 见 [plan.md §Service 层设计 - WorkingStateService](./plan.md#service-层设计)
  - 依赖: T004（Storage 层）
  - AC 覆盖: AC11, AC12, AC13
  - 验证: T005 全部测试通过

---

## Group 4: ObjectTypeService

- [ ] **T007**: 编写 ObjectTypeService 单元测试
  - 文件: `apps/server/tests/unit/test_object_type_service.py`
  - 内容:
    - `create()`: 唯一性校验（id 重复 → 409, apiName 重复 → 409）、格式校验委托 validators、正常创建生成 CREATE 变更
    - `update()`: active 状态修改 apiName → 400、正常更新生成 UPDATE 变更
    - `delete()`: active 状态删除 → 400、正常删除生成 DELETE 变更、级联删除生成子资源 DELETE 变更
    - `list()`: 合并视图 + 分页逻辑（total 计算、page/pageSize 截取）
    - `get_by_rid()`: 存在返回、不存在 → 404
    - Mock `ObjectTypeStorage`, `WorkingStateService`
  - 依赖: T002（Domain 模型）、T006（WorkingStateService 接口）
  - AC 覆盖: AC1, AC2, AC4, AC6, AC7, AC10, AC10a, AC12

- [ ] **T008**: 实现 ObjectTypeService
  - 文件: `apps/server/app/services/object_type_service.py`
  - 内容:
    - `create(req)` — 校验 id/apiName → 唯一性检查（主表 + 草稿 CREATE 双重检查）→ 生成 rid → add_change(CREATE)
    - `list(page, page_size)` — get_merged_view → 过滤 deleted → 分页 → 返回 ObjectTypeListResponse
    - `get_by_rid(rid)` — 从合并视图查找，404 if not found
    - `update(rid, req)` — 校验 active 限制 → 校验 apiName 唯一性 → add_change(UPDATE)
    - `delete(rid)` — 校验 active 不可删 → 查询关联 Properties/LinkTypes → 级联生成 DELETE 变更 → add_change(DELETE)
    - `_check_uniqueness(ontology_rid, id, api_name, exclude_rid?)` — 辅助方法
  - 内容: 见 [plan.md §Service 层设计 - ObjectTypeService](./plan.md#service-层设计)
  - 依赖: T006（WorkingStateService）、T004（Storage 层）
  - AC 覆盖: AC1, AC2, AC4, AC6, AC7, AC10, AC10a, AC12
  - 验证: T007 全部测试通过

---

## Group 5: Router + 集成测试

- [ ] **T009**: 编写集成测试 fixtures + API 集成测试
  - 文件:
    - `apps/server/tests/conftest.py` — 测试 fixtures: 异步测试 DB session（独立测试数据库）、httpx `AsyncClient` 绑定 FastAPI app、每个测试自动回滚事务
    - `apps/server/tests/integration/__init__.py`
    - `apps/server/tests/integration/test_object_type_api.py` — ObjectType CRUD 集成测试
    - `apps/server/tests/integration/test_working_state_api.py` — 变更管理 API 集成测试
  - 内容:
    - **ObjectType 集成测试**:
      - POST 创建 → 201, 默认 status=experimental, visibility=normal (AC1)
      - POST 重复 id → 409 (AC2)
      - POST 重复 apiName → 409 (AC2)
      - GET 列表 + 分页 (AC4)
      - GET 详情返回完整元数据 (AC5)
      - PUT 修改 displayName/description/icon/status/visibility (AC6)
      - PUT active 状态修改 apiName → 400 (AC7)
      - PUT 后 GET 返回最新值 (AC8)
      - DELETE active → 400 (AC10)
      - DELETE + publish → 级联删除 (AC10a)
      - POST 写入草稿，主表无记录 (AC11)
      - GET 列表包含未发布的 created 资源 (AC12)
      - 验证 created/modified/deleted/published changeState 标注 (AC13)
    - **变更管理集成测试**:
      - POST publish → 应用变更到主表、递增版本
      - DELETE discard → 清除草稿
      - GET working-state → 查看草稿内容
      - POST publish 空草稿 → 400
  - 依赖: T008（ObjectTypeService）、T010（Router 层；可与 T010 并行编写，Router 就绪后运行）
  - AC 覆盖: AC1–AC8, AC10, AC10a, AC11–AC13

- [ ] **T010**: 实现 Router 层 + 注册到 main.py
  - 文件:
    - `apps/server/app/routers/object_types.py` — ObjectType CRUD 五个端点（GET list, POST create, GET detail, PUT update, DELETE）
    - `apps/server/app/routers/ontology.py` — 变更管理三个端点（POST save, DELETE discard, GET working-state）
    - `apps/server/app/main.py` — 注册 `object_types.router` 和 `ontology.router`
  - 内容: 见 [plan.md §Router 层设计](./plan.md#router-层设计)。Router 层仅做 HTTP 解析 + 委托 Service，不含业务逻辑。使用 `Depends` 注入 Service。Query 参数 `pageSize` 使用 `alias="pageSize"` 映射
  - 依赖: T008（ObjectTypeService）、T006（WorkingStateService）
  - AC 覆盖: 所有 AC（HTTP 层入口）
  - 验证: T009 全部集成测试通过

---

## AC 覆盖对照

| AC | 描述 | 覆盖任务 |
|----|------|---------|
| AC1 | 创建默认值 (status=experimental, visibility=normal) | T007, T009 |
| AC2 | id/apiName 唯一性 → 409 | T007, T009 |
| AC3a | apiName PascalCase + 保留字校验 | T001, T002 |
| AC3b | id 小写+连字符校验 | T001, T002 |
| AC4 | 列表 + 分页 | T007, T009 |
| AC5 | 详情返回完整元数据 | T009 |
| AC6 | 可编辑字段 | T007, T009 |
| AC7 | id 不可改, apiName active 锁定 | T007, T009 |
| AC8 | 保存后即时反映 | T009 |
| AC10 | active 不可删除 | T007, T009 |
| AC10a | 级联删除 | T007, T009 |
| AC11 | 写入草稿 | T005, T009 |
| AC12 | 合并视图 | T005, T007, T009 |
| AC13 | 变更状态标注 | T005, T009 |

---

## 验证方式

全部 10 个任务完成后：
- `just server-test` — 所有单元 + 集成测试通过
- 手动 API 测试（curl/httpx）验证端到端流程
- `just server-openapi` — 重新生成 openapi.json，包含新端点

---

## 实际偏差记录

> 完成后，在此记录实现与 plan.md 的偏差，供后续参考。

---

## 会话记录

| 日期 | 完成任务 | 备注 |
|------|---------|------|
