# Tasks: Data Connection（数据连接）

**关联规范**: [spec.md](./spec.md)
**技术方案**: [design.md](./design.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 2026-03-04 评审通过（含评审意见回写） |
| design.md | ✅ 已评审 | 2026-03-04 评审通过（含评审意见回写） |
| tasks.md | ✅ 已拆解 | 2026-03-04 评审通过 |
| 实现 | 🔧 进行中 | 16 / 17 完成（仅 T017 端到端待验证）|

---

## 实施状态说明

后端核心代码已实现（MySQL 连接管理、Excel/CSV 上传、Dataset CRUD、导入任务、加密服务）。
本 tasks 文件分为两部分：
1. **后端修复任务（T001–T007）**：修复评审发现的 Critical/Major 问题
2. **前端任务（T008–T017）**：全部新建

---

## 开发模式

后端修复任务采用**实现优先**模式（修改已有代码 + 补充/更新测试）。
前端任务采用标准 **Test-First** 模式（先测试后实现）。

---

## 后端修复任务（T001–T007）

### T001: CryptoService 单例化

- [x] **T001**: CryptoService 单例化 + 测试补充
  - 文件:
    - `apps/server/app/services/crypto_service.py` — 改为模块级单例（`get_crypto_service()` 工厂函数）
    - `apps/server/tests/unit/test_crypto_service.py` — 补充：多次调用 `get_crypto_service()` 返回同一实例；开发模式自动生成密钥在进程内保持一致
  - 内容: 见 [design.md AD-6](./design.md#补充决策修复方案)
  - 覆盖 AC: AC-CM01（密码加密存储依赖稳定密钥）
  - 依赖: 无

---

### T002: SQL 注入修复 — 表名白名单校验

- [x] **T002**: MySQL 表名白名单校验 + 行数上限
  - 文件:
    - `apps/server/app/services/mysql_import_service.py` — 新增 `_validate_table_name()`（SHOW TABLES 白名单 + 正则辅助校验）；`start_import()` 添加 10 万行 COUNT 检查
    - `apps/server/tests/unit/test_mysql_import_service.py` — 补充：非法表名 → 422、表名不存在 → 422、超过 10 万行 → 422
  - 内容: 见 [design.md AD-7, AD-11](./design.md#critical-修复)
  - 覆盖 AC: AC-MI04（导入前置校验）、AC-MI09（行数上限）
  - 依赖: 无

---

### T003: 后台任务异常日志 + done_callback

- [x] **T003**: 后台任务异常处理增强
  - 文件:
    - `apps/server/app/services/mysql_import_service.py` — `_run_import()` except 块添加 `logger.exception()`
    - `apps/server/app/services/file_import_service.py` — `_run_import()` except 块添加 `logger.exception()`
  - 内容: 见 [design.md AD-8](./design.md#critical-修复)
  - 覆盖 AC: AC-MI05（任务状态正确反映失败）
  - 依赖: 无

---

### T004: Response Model 补齐

- [x] **T004**: 补齐 Pydantic response_model + 请求模型迁移
  - 文件:
    - `apps/server/app/domain/mysql_connection.py` — 新增 `ConnectionTestResponse`
    - `apps/server/app/domain/import_task.py` — 新增 `FileUploadPreviewResponse`、`FilePreviewColumn`、`MySQLImportRequest`、`FileConfirmRequest`
    - `apps/server/app/routers/mysql_connections.py` — 路由装饰器添加 `response_model=ConnectionTestResponse`
    - `apps/server/app/routers/imports.py` — 路由装饰器添加 `response_model`；删除内联请求模型定义，改用 domain 层模型
    - `apps/server/tests/unit/test_mysql_connections_router.py` — 更新 mock 返回值匹配新 response_model
    - `apps/server/tests/unit/test_dataset_router.py` — 验证无回归
  - 内容: 见 [design.md AD-9 + §Pydantic Schema](./design.md#pydantic-schema追认--已实现)
  - 覆盖 AC: AC-CM02（测试连接响应结构化）、AC-FU01（上传预览响应结构化）
  - 依赖: 无

---

### T005: 文件预览缓存 TTL 清理

- [x] **T005**: 文件预览缓存添加 TTL 过期清理
  - 文件:
    - `apps/server/app/services/file_import_service.py` — `_previews` 改为存储 `(data, created_at)` 元组；`upload_and_preview` 入口调用 `_cleanup_expired_previews()`（30 分钟过期）
    - `apps/server/tests/unit/test_file_import_service.py` — 补充：过期 token 被清理、未过期 token 保留
  - 内容: 见 [design.md AD-10](./design.md#major-修复)
  - 覆盖 AC: AC-FU02（fileToken 生命周期）
  - 依赖: 无

---

### T006: 连接删除端点 + DatasetStorage 简化

- [x] **T006**: 新增 DELETE /mysql-connections/{rid} + 简化 DatasetStorage.delete()
  - 文件:
    - `apps/server/app/routers/mysql_connections.py` — 新增 `DELETE /api/v1/mysql-connections/{rid}`
    - `apps/server/app/storage/mysql_connection_storage.py` — 新增 `delete()` 方法
    - `apps/server/app/services/mysql_import_service.py` — 新增 `delete_connection()` 方法
    - `apps/server/app/storage/dataset_storage.py` — 简化 `delete()`，只删主记录，依赖 CASCADE
    - `apps/server/tests/integration/test_mysql_connections_api.py` — 补充：删除成功 204、RID 不存在 404
    - `apps/server/tests/unit/test_dataset_storage.py` — 更新 delete 测试
  - 覆盖 AC: AC-CM06（删除成功）、AC-CM07（删除不存在）
  - 依赖: 无

---

### T007: openapi.json 重新生成 + 后端全量验证

- [x] **T007**: 重新生成 openapi.json + 运行全量后端测试
  - 文件:
    - `apps/server/openapi.json` — 重新生成（反映新增的 response_model、DELETE 端点、请求模型迁移）
  - 内容:
    - 启动 FastAPI 应用提取 OpenAPI spec
    - `cd apps/server && uv run pytest -v` 全部通过
  - 依赖: T001–T006 全部完成

---

## 前端任务（T008–T017）

### T008: OpenAPI 类型重新生成 + API Hooks

- [x] **T008**: 类型重新生成 + API Hooks 更新
  - 文件:
    - `apps/web/src/generated/api.ts` — `npx openapi-typescript` 重新生成
    - `apps/web/src/api/types.ts` — 追加 Dataset / MySQLConnection / ImportTask 类型别名
    - `apps/web/src/api/mysql-connections.ts` — 更新/补充 hooks（含 useDeleteMySQLConnection）
    - `apps/web/src/api/imports.ts` — 更新/补充 hooks
    - `apps/web/src/api/datasets.ts` — 更新/补充 hooks
  - 覆盖 AC: 无直接 AC（基础设施）
  - 依赖: T007（后端 openapi.json 已更新）

---

### T009: i18n 翻译

- [x] **T009**: Data Connection i18n 翻译文件
  - 文件:
    - `apps/web/src/locales/en-US/` — 新建或追加 `dataConnection` 命名空间
    - `apps/web/src/locales/zh-CN/` — 对应中文翻译
  - 内容: 见 [design.md §i18n 命名空间](./design.md#i18n-命名空间)
  - 覆盖 AC: 无直接 AC（基础设施）
  - 依赖: 无

---

### T010: DataConnectionPage 框架 + 路由注册

- [x] **T010**: DataConnectionPage 主页面（Tabs 框架）+ 路由 + 侧边栏入口
  - 文件:
    - `apps/web/src/pages/data-connection/DataConnectionPage.tsx` — 新建：Ant Design Tabs（Connections / Datasets）
    - 路由配置文件 — 注册 `/ontology/data-connection` 路由
    - `apps/web/src/components/layout/` 相关文件 — 侧边栏添加 "Data Connection" 菜单项
  - 覆盖 AC: AC-NV01（侧边栏入口 + 默认 Connections Tab）
  - 依赖: T009（i18n）

---

### T011: Connections Tab

- [x] **T011**: Connections Tab 实现（列表 + 测试连接 + 删除）
  - 测试文件: `apps/web/src/pages/data-connection/__tests__/ConnectionsTab.test.tsx`
  - 实现文件: `apps/web/src/pages/data-connection/components/ConnectionsTab.tsx`
  - 测试内容:
    - 连接列表渲染（名称 / Host / Database / 创建时间）
    - "Test" 按钮点击后显示成功/失败反馈
    - "Delete" 按钮点击后确认弹窗 → 删除
    - 空列表状态
  - 覆盖 AC: AC-CM04（列表）、AC-CM02（测试）、AC-CM06（删除）
  - 依赖: T008（API Hooks）、T010（页面框架）

---

### T012: MySQL 导入向导（4 步 Modal）

- [x] **T012**: MySQLImportWizard 实现（4 步向导）
  - 测试文件: `apps/web/src/pages/data-connection/__tests__/MySQLImportWizard.test.tsx`
  - 实现文件: `apps/web/src/pages/data-connection/components/MySQLImportWizard.tsx`
  - 测试内容:
    - Step 1: 连接配置表单渲染、测试连接按钮、"使用已有连接"下拉
    - Step 2: 表列表渲染、选择表后显示列结构 + 数据预览
    - Step 3: Dataset 名称输入、列选择
    - Step 4: 导入进度显示、完成后返回 Datasets Tab
    - 步骤导航（Next/Previous/Cancel）
  - 覆盖 AC: AC-CM01（保存连接）、AC-CM02（测试连接）、AC-MI01~MI07
  - 依赖: T008（API Hooks）、T010（页面框架）

---

### T013: Excel/CSV 上传向导（3 步 Modal）

- [x] **T013**: FileUploadWizard 实现（3 步向导）
  - 测试文件: `apps/web/src/pages/data-connection/__tests__/FileUploadWizard.test.tsx`
  - 实现文件: `apps/web/src/pages/data-connection/components/FileUploadWizard.tsx`
  - 测试内容:
    - Step F1: 拖拽/点击上传区域、文件大小限制提示、格式限制提示
    - Step F2: 列预览表格、类型下拉覆盖、Dataset 名称输入、首行表头开关
    - Step F3: 导入进度、完成后返回 Datasets Tab
    - 步骤导航
  - 覆盖 AC: AC-FU01~FU06
  - 依赖: T008（API Hooks）、T010（页面框架）

---

### T014: Datasets Tab（列表 + 详情 + 预览 + 删除）

- [x] **T014**: Datasets Tab 实现
  - 测试文件: `apps/web/src/pages/data-connection/__tests__/DatasetsTab.test.tsx`
  - 实现文件:
    - `apps/web/src/pages/data-connection/components/DatasetsTab.tsx`
    - `apps/web/src/pages/data-connection/components/DatasetPreviewDrawer.tsx`
  - 测试内容:
    - Dataset 列表渲染（名称 / 来源类型 / 行数 / 列数 / 导入时间 / in_use 状态）
    - in_use 标记显示 + Tooltip 含 ObjectType 名称
    - 搜索过滤
    - "Preview" 按钮打开数据预览抽屉
    - "Delete" 按钮：未引用时可删除；in_use 时置灰 + Tooltip 提示
    - 空列表状态
    - "Import Dataset" 下拉按钮（From MySQL / Upload File）
  - 覆盖 AC: AC-DM01~DM07
  - 依赖: T008（API Hooks）、T010（页面框架）

---

### T015: Zustand Store

- [x] **T015**: DataConnectionStore 实现 + 测试
  - 测试文件: `apps/web/src/stores/__tests__/data-connection-store.test.ts`
  - 实现文件: `apps/web/src/stores/data-connection-store.ts`
  - 测试内容:
    - MySQL 向导：open/close/step 导航
    - 文件向导：open/close/step 导航
    - 预览抽屉：open(rid)/close
    - 关闭向导时重置步骤
  - 覆盖 AC: 无直接 AC（UI 状态管理）
  - 依赖: 无

---

### T016: 前端测试全量验证

- [ ] **T016**: TypeScript 编译 + 前端全量测试
  - 内容:
    - `npx tsc --noEmit` 无类型错误
    - 更新受影响的现有测试（mock 数据、import 路径等）
    - `pnpm test --run` 全部通过
  - 依赖: T011–T015 全部完成

---

### T017: 端到端流程验证

- [ ] **T017**: 端到端集成验证
  - 内容:
    - 启动后端 + 前端开发服务器
    - 流程 1: 侧边栏 → Data Connection → Connections Tab → 新建 MySQL 连接 → 测试 → 保存
    - 流程 2: Import Dataset → From MySQL → 4 步向导 → 完成导入
    - 流程 3: Import Dataset → Upload File → CSV 上传 → 3 步向导 → 完成
    - 流程 4: Datasets Tab → 搜索 → 预览 → 删除（非 in_use）
    - 流程 5: 003 创建 OT 向导 → Step 1 选择 Dataset → 确认 in_use 标记
  - 依赖: T016

---

## 依赖关系

```
后端修复:
T001 (CryptoService 单例) — 独立
T002 (SQL 注入 + 行数限制) — 独立
T003 (异常日志) — 独立
T004 (response_model) — 独立
T005 (预览缓存 TTL) — 独立
T006 (连接删除 + delete 简化) — 独立
T007 (openapi.json + 全量验证) — 依赖 T001–T006

前端:
T008 (类型 + API Hooks) — 依赖 T007
T009 (i18n) — 独立
T010 (页面框架 + 路由 + 侧边栏) — 依赖 T009
T011 (Connections Tab) — 依赖 T008, T010
T012 (MySQL 导入向导) — 依赖 T008, T010
T013 (文件上传向导) — 依赖 T008, T010
T014 (Datasets Tab) — 依赖 T008, T010
T015 (Zustand Store) — 独立
T016 (前端全量验证) — 依赖 T011–T015
T017 (端到端) — 依赖 T016
```

---

## 与 003 协同开发编排

```
阶段 A（可并行）:
  010 T001–T006 后端修复  ←→  003 T006–T015 后端 OT/WS 修改

阶段 B（有依赖）:
  010 T007 openapi.json 重新生成
      ↓
  010 T008–T015 前端（Data Connection 页面 + 向导）
      ↓
  003 T017–T026 前端（OT 向导 Step 1 依赖 Dataset 列表）

阶段 C:
  010 T016–T017 + 003 T026 端到端集成验证
```

---

## 验证方式

全部任务完成后：

```bash
# 后端
cd apps/server && uv run pytest -v                    # 全部测试通过

# 前端
cd apps/web && npx tsc --noEmit                       # 无类型错误
cd apps/web && pnpm test --run                        # 全部测试通过

# 端到端
# 010 导入数据 → 003 创建 OT 向导选择 Dataset → 完成创建
```

---

## 实际偏差记录

> 完成后，在此记录实现与 design.md 的偏差，供后续参考。

- （待填写）
