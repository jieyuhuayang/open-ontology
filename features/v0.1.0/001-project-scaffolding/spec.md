# Feature: Project Scaffolding（项目脚手架）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §技术架构]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Done

---

## 用户故事

作为 **开发者**，
我希望 **能够用一条命令启动完整的本地开发环境**，
以便 **快速开始特性开发，无需手动配置各服务**。

---

## 验收标准

- **AC1**: 执行 `docker compose up` 后，所有服务（API、数据库、前端 dev server）均正常运行
- **AC2**: 访问 `http://localhost:5173`，前端页面正常加载（无白屏、无控制台错误）
- **AC3**: 访问 `http://localhost:8000/docs`，FastAPI Swagger UI 正常显示
- **AC4**: 数据库连接可用，Alembic 基础迁移可成功执行
- **AC5**: 前后端代码修改后，热重载（Hot Reload）正常工作
- **AC6**: `pnpm test` 和 `pytest` 均可在各自工作目录中执行并通过（即使暂无测试用例）

---

## 边界情况

- **不支持**：生产环境部署配置（延后到 v0.2.0）
- **不支持**：CI/CD pipeline（延后到 v0.2.0）
- 当端口冲突时，`docker compose` 应报错提示，而非静默失败

---

## 非功能要求

- **性能**: 冷启动（`docker compose up --build`）不超过 3 分钟
- **可用性**: README 包含完整的本地启动说明（含前置依赖版本要求）

---

## 技术栈（参考架构文档）

参见 [docs/architecture/04-tech-stack-recommendations.md]

- **Monorepo**: pnpm workspaces
- **后端**: Python 3.12 + FastAPI + SQLAlchemy + Alembic
- **前端**: React 18 + TypeScript + Vite + Ant Design
- **数据库**: PostgreSQL 16
- **容器**: Docker Compose（开发环境）

---

## 相关文档

- 架构参考: [docs/architecture/01-system-architecture.md]
- 技术栈: [docs/architecture/04-tech-stack-recommendations.md]
