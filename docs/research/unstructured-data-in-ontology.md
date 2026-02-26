# 调研报告：非结构化数据在 Open Ontology 中的管理与利用

> 版本：v1.0 | 日期：2026-02-26

## 目录

1. [调研背景与问题定义](#1-调研背景与问题定义)
2. [Palantir 的参考架构](#2-palantir-的参考架构)
3. [行业趋势](#3-行业趋势)
4. [技术架构模式](#4-技术架构模式)
5. [Open Ontology 现状差距分析](#5-open-ontology-现状差距分析)
6. [建议与路线图](#6-建议与路线图)

---

## 1. 调研背景与问题定义

### 1.1 背景

Open Ontology 的当前设计以**结构化数据（表格型数据集）**为核心。数据层到对象层的映射路径是"列→属性"——数据集类似电子表格中的表格数据，对象层将表格型数据集中的行与列转换为一组语义概念体系。

然而，在 agent 时代，企业数据的格局已发生根本变化：

- **约 80% 的企业数据是非结构化的**：PDF 合同、技术文档、邮件、图片、视频、音频、CAD 图纸等
- **LLM/Agent 的核心能力在于理解和推理非结构化内容**：agent 需要同时推理结构化关系和非结构化内容
- **RAG（检索增强生成）已成为标配**：几乎所有企业 AI 应用都需要对非结构化数据进行检索和生成

### 1.2 核心问题

本调研旨在回答以下问题：

1. 行业领先平台（特别是 Palantir）如何在本体中管理非结构化数据？
2. 当前行业在"本体 + 非结构化数据 + Agent"方向上有哪些趋势？
3. Open Ontology 的现有设计与这些最佳实践之间的差距在哪里？
4. 应如何规划非结构化数据的支持路线？

---

## 2. Palantir 的参考架构

Palantir 的 Ontology 平台是本体驱动企业 AI 的行业标杆。其平台已形成完整的非结构化数据管理和利用体系。

### 2.1 Media Sets（媒体集）：非结构化数据的一等公民存储

Palantir Foundry 将 **Media Set（媒体集）** 作为非结构化数据的一等数据源类型，与 Dataset（表格数据集）并列。

**核心能力**：
- 专为高规模、非结构化数据设计，支持音频、图像、视频和文档的处理
- 支持灵活存储、计算优化和 schema-specific 转换
- 内置特定格式的处理能力：
  - **DICOM**：医学影像（CT、MRI 等），自动提取 Patient ID、Study ID 等元数据
  - **音频转录**：支持导入音频文件为媒体集并构建转录工作流
  - **视频处理**：支持视频帧提取和分析
- **Virtual Media Sets**：支持创建虚拟媒体集，无需物理文件存储

**Media Set 类型**：
- **标准 Media Set**：物理文件存储，具有事务一致性
- **Virtual Media Set**：直接从外部云存储（Azure Blob、Amazon S3）读取，绕过数据导入/传输，实现外部非结构化存储的直接联邦
- **增量 Media Set**：支持新文件到达时的流式更新

**操作约束**：每个事务 10,000 文件限制（批次限制，非存储限制）；高吞吐场景可使用无事务媒体集。

**关键设计原则**：非结构化数据不是表格数据的附件，而是平台的**一等公民数据源**。

> 参考：[Palantir Media Sets 文档](https://www.palantir.com/docs/foundry/data-integration/media-sets)

### 2.2 Media Reference 属性：连接非结构化数据与本体

**Media Reference** 是 Palantir Ontology 中的一种属性基础类型（Property Base Type），用于将本体中的对象与媒体集中的具体媒体项关联。

**内部结构**：Media Reference 是一个包含三个必填字段的类型化结构体：

| 字段 | 描述 |
|------|------|
| `mimeType` | 引用文件的 MIME 类型（如 `application/pdf`、`image/png`） |
| `mediaSetRid` | 包含该文件的 Media Set 的资源标识符（RID） |
| `mediaItemRid` | Media Set 内特定项的标识符 |

这种指针结构意味着本体对象**不嵌入原始字节**——它只携带轻量级引用。所有理解 Media Reference 的平台服务（Object Explorer、Workshop、AIP）可以按需检索、流式传输或预览实际内容。

**配置要求**：
- 对象类型的**支撑数据集**必须包含 `media reference` 类型的列（这是一个独立的列类型，不是字符串）
- 对象类型的 **Capabilities** 选项卡中必须指定 **Media Source**——指向 Media Reference 解析目标的 Media Set
- 对象类型因此同时由**表格数据集**（结构化属性）和 **Media Set**（非结构化内容）支撑

**编程访问**（TypeScript Functions）：
```typescript
// 读取媒体项的原始二进制内容
const blob = await mediaItem.readAsync();
// 获取元数据（文件大小、MIME 类型）
const meta = await mediaItem.getMetadataAsync();
// 对文档执行 OCR
const ocrResult = await mediaItem.ocrAsync({ pages: [1, 5] });
// 转录音频
const transcript = await mediaItem.transcribeAsync({ language: 'en' });
```

**架构意义**：Media Reference 是连接结构化本体世界和非结构化媒体世界的**桥梁属性**——对象通过 Media Reference 属性"拥有"其关联的非结构化内容。这种"引用而非复制"的设计允许非结构化内容被链接到本体中，而不会造成数据膨胀。

> 参考：[Media in Ontology](https://www.palantir.com/docs/foundry/media-sets-advanced-formats/media-in-ontology)

### 2.3 Document Processing Pipeline：提取→分块→嵌入→入本体

Palantir 提供了完整的文档处理管道，将非结构化文档转化为可被本体检索和推理的结构化表征。

Palantir 通过 **Pipeline Builder**（可视化无代码管道构建器）提供完整的文档处理流水线。

**Pipeline 步骤**（共 11 步）：

```
① 导入 PDF 为 Media Set
② 添加 Media Set 到 Pipeline Builder
③ Get Media References（提取媒体项指针的表格视图）
④ 文本提取（Extract Text / OCR / Layout-Aware）
⑤ 分块（Chunk String：按优先级分隔符拆分，~256字符/块，~20字符重叠）
⑥ Explode Array with Position（每块一行，携带位置信息）
⑦ 字段提取（分离 position 和 chunk_text）
⑧ 唯一标识符生成（chunk_id = object_id + "_" + position）
⑨ 嵌入生成（Text to Embeddings）
⑩ 创建 Chunk 对象类型（含 Vector 属性）
⑪ 创建 Link Type 回连父对象
```

**文本提取选项**：

| 提取板 | 描述 |
|--------|------|
| Extract text from PDF | 标准嵌入文本提取 |
| Extract text from PDF (using OCR) | 扫描页面的光学字符识别 |
| Extract layout-aware content from PDF | 保留语义布局（标题、表格、列） |
| Extract layout-aware content from images | 带空间感知的 OCR |

**分块算法细节**：
1. 从最高优先级分隔符开始（段落 → 句子 → 单词）
2. 拆分直到每块 ≤ 目标大小（默认约 256 字符）
3. 相邻块之间约 20 字符重叠（保留上下文连续性）

**Chunk 对象类型结构**：

| 属性 | 类型 | 描述 |
|------|------|------|
| `chunk_id` | String (Primary Key) | 块的唯一标识符 |
| `object_id` | String | 父文档对象的外键 |
| `chunk` | String | 文本内容 |
| `embedding` | Vector (维度 N) | 嵌入向量 |

**嵌入模型支持**：
- **OpenAI Ada**（`text-embedding-ada-002`）：Pipeline Builder 内置支持，适合文档间相似性
- **MS MARCO v3**：专门训练于查询-段落检索
- **all-MiniLM-L6-v2**：384 维，轻量级开源模型
- **Pix2Struct**：多模态模型，擅长从图表/表格图像中提取结构化信息
- **Microsoft UDOP**：通用文档处理的开源选项

**2025 年新增**：Pipeline Builder 新增原生媒体表达式，支持图像操作、PDF 拆分、图像到嵌入（`imageToEmbeddingsV1`）等，不再需要自定义 Python 代码。

> 参考：[Palantir Semantic Search / OAG](https://www.palantir.com/docs/foundry/ontology/ontology-augmented-generation)

### 2.4 Semantic Search：向量属性 + KNN + 混合检索

Palantir 的 Object Storage V2 提供了强大的语义搜索能力。

**Vector 属性配置**：
- **维度**：嵌入数组长度，必须匹配嵌入模型输出维度（**最大 2048**）
- **相似性函数**：KNN 距离度量（如余弦相似性）
- **约束**：Vector 属性不能用标准 filter 查询（只能通过 KNN），不能放入数组
- **KNN 返回值**：K = 1-100

**检索策略**：

| 策略 | 描述 | 适用场景 |
|------|------|----------|
| **向量语义搜索** | 嵌入查询内容，对带有向量属性的对象执行 KNN 搜索 | 语义相似性匹配 |
| **关键词搜索** | Object Storage V2 的内置相关性索引，自动考虑域特定上下文 | 精确术语匹配 |
| **HyDE（假设文档嵌入）** | 先让 LLM 生成一个假设的回答文档，再对其进行嵌入检索 | 弥合查询与文档之间的语义不对称 |
| **混合搜索 + RRF** | 并行执行向量搜索和关键词搜索，使用倒数排名融合（Reciprocal Rank Fusion）合并结果，公式：`1/(k+rank)` | 兼顾语义和精确匹配 |
| **查询增强** | 查询富化（添加同义词/相关术语）+ 查询提取（去除停用词） | 提升检索召回率 |

**Object Storage V2 的关键改进**：
- 搜索无对象数量限制（V1 限制为 10,000）
- 内置"相关性"概念，自动考虑块的域特定上下文
- 增量对象索引，显著提升性能

> 参考：[Object Storage V2](https://www.palantir.com/docs/foundry/object-backend/overview)

### 2.5 OAG（Ontology-Augmented Generation）：LLM 与本体的集成模式

OAG 是 Palantir 提出的核心概念，是 RAG 的升级版本。

**OAG vs. RAG**：

| 维度 | 传统 RAG | Palantir OAG |
|------|----------|--------------|
| 检索内容 | 非结构化文本块 | **结构化本体对象**（带有定义好的历史、关系和约束） |
| 上下文形式 | 文本片段 | 对象属性 + 关系 + 业务语义 |
| 幻觉控制 | 通过引用源文本降低 | **从根本上阻止**——模型接收的是预验证的结构化数据 |
| 设计理念 | 给模型检索上下文 | 给模型**操作现实**（决策三要素：数据、逻辑、动作） |

**关键引述**：

> "OAG takes RAG to the next level by grounding LLMs in the operational reality of a given enterprise via the decision-centric Ontology, which brings together the three constituent elements of decision-making — data, logic, and actions — in a single system."

> "By feeding the LLM pre-structured objects with defined histories, relationships, and constraints, Palantir fundamentally blocks the model's ability to guess or hallucinate."

**技术实现**：
- LLM 通过工具调用（Tool Use）请求本体数据
- AIP Logic 执行工具调用，在用户权限范围内访问本体
- 本体元数据（对象类型及其属性的描述）被注入 Prompt，引导 LLM 生成正确的查询

> 参考：[Palantir OAG Blog](https://blog.palantir.com/building-with-palantir-aip-data-tools-for-rag-oag-b3b509c8b0f3)、[Reducing Hallucinations Blog](https://blog.palantir.com/reducing-hallucinations-with-the-ontology-in-palantir-aip-288552477383)

### 2.6 AIP Agent Studio：Agent 同时推理结构化关系和非结构化内容

Palantir AIP Agent Studio 是构建企业 AI Agent 的完整框架。

**Agent 上下文类型**：

| 上下文类型 | 数据源 | 检索方式 |
|-----------|--------|----------|
| **Ontology Context** | 本体中的结构化对象 | 固定 N 个对象，或语义搜索 K 个最相关对象（需要对象类型有向量嵌入属性） |
| **Document Context** | 外部文档 | 全文模式 或 相关块模式（语义搜索最相关的文档片段） |
| **Function-backed Context** | 自定义 TypeScript 函数 | 实现 `AipAgentsContextRetrieval` 接口，支持混合检索等自定义逻辑 |

**Agent 可用工具**：
- **Search Objects**：在本体中搜索对象
- **Query Aggregation**：聚合查询
- **Edit Object / Create Object**：通过 Actions 编辑本体
- **Calculator**：精确数学计算
- **Call Function**：调用自定义函数

**Agent 分级框架**：
| 层级 | 能力 | 产品 |
|------|------|------|
| Tier 1 | 临时分析 | AIP Threads |
| Tier 2 | 任务特定 Agent | AIP Agent Studio |
| Tier 3 | Agent 应用 | Workshop 集成 |
| Tier 4 | 自动化 Agent | AIP Automate |

**关键设计**：Agent 同时使用 Ontology Context（结构化）和 Document Context（非结构化），通过 Function-backed Context 实现自定义混合检索。所有上下文类型都支持引用（Citations），用户可以追溯 Agent 回答的来源。

> 参考：[AIP Agent Studio Overview](https://www.palantir.com/docs/foundry/agent-studio/overview)、[Retrieval Context](https://www.palantir.com/docs/foundry/agent-studio/retrieval-context)

---

## 3. 行业趋势

### 3.1 Microsoft Fabric IQ（2025 年 11 月）：本体作为平台一等概念

Microsoft 在 Ignite 2025 上发布了 **Fabric IQ**，将本体提升为其数据平台的核心概念。

**五大集成能力**：

| 能力 | 描述 |
|------|------|
| **Ontology（本体）** | 业务实体、关系、规则和目标的共享模型 |
| **Semantic Model（语义模型）** | BI 定义扩展到运营和 AI 领域 |
| **Graph（图引擎）** | 原生图引擎，支持多跳推理和全局洞察，使用新兴 GQL 标准 |
| **Data Agent（数据代理）** | 使用结构化业务语义回答问题的虚拟分析师 |
| **Operations Agent（运营代理）** | 实时推理、学习和行动的自主 Agent |

**本体技术架构**：
- **实体类型（Entity Types）**：可复用的逻辑模型，标准化名称、描述、标识符、属性和约束
- **属性（Properties）**：具有声明数据类型、数据绑定和语义注解的命名事实
- **关系（Relationships）**：类型化、有方向的链接，可携带属性（如 `distance`、`confidence`）和基数规则
- **规则和约束（Rules & Constraints）**：业务约束直接存在于本体中
- **数据绑定（Data Bindings）**：连接本体定义到 OneLake 中的具体数据——Lakehouse 表、Eventhouse 流、Power BI 语义模型

**关键创新**：
- **原生图引擎**：基于 OneLake 表提供标签属性图（Labeled Property Graph），原生支持 GQL 标准（ISO/IEC 39075:2024）和内置图算法，无需将数据迁移到单独的图存储
- **本体即语义骨架**：本体定义实体类型、属性和关系类型，支持从现有数据源自动引导（bootstrap）本体结构
- **Agent 语义层**：Agent 在本体定义的共享业务语义中推理，确保 AI 回答基于共享定义而非猜测
- **版本控制和治理**：支持本体定义的版本控制、一致性验证和健康监控

**对 Open Ontology 的启示**：Microsoft 的入局验证了"本体平台"赛道的价值，且其设计也将结构化数据（表格/图）和非结构化数据（通过 Agent）统一在本体语义层下。

> 参考：[Microsoft Fabric IQ 发布博客](https://blog.fabric.microsoft.com/en-us/blog/from-data-platform-to-intelligence-platform-introducing-microsoft-fabric-iq)、[Fabric IQ Overview](https://learn.microsoft.com/en-us/fabric/iq/overview)

### 3.2 Salesforce Agentforce：结构型 + 描述型双本体

Salesforce 在其 Agentforce 平台中提出了**双本体模型**：

| 本体类型 | 作用 | 内容 |
|---------|------|------|
| **结构型本体（Structural Ontology）** | 数据层 | 将概念映射到数据对象和约束 |
| **描述型本体（Descriptive Ontology）** | 决策层 | 建模 Agent 护栏、结果和决策逻辑 |

**关键洞察**：本体不仅是数据建模工具，还是 **Agent 行为约束的治理框架**。结构型本体让 Agent 知道"什么数据存在"，描述型本体让 Agent 知道"什么行为被允许"。

> 参考：[Salesforce Two Types of Ontologies](https://www.salesforce.com/blog/structural-and-descriptive-ontology/)

### 3.3 GraphRAG / HybridRAG：向量搜索 + 图遍历的混合检索

**Microsoft GraphRAG**（2024, arXiv:2404.16130）：

索引管道（多阶段）：
```
LoadDocuments → ChunkDocuments → ExtractGraph(实体+关系)
→ ExtractClaims → EmbedChunks → DetectCommunities(Leiden算法)
→ EmbedEntities → GenerateReports(社区摘要) → EmbedReports
```

查询模式：

| 模式 | 适用场景 | 机制 |
|------|---------|------|
| **本地搜索** | 特定实体问题 | 向量搜索实体嵌入 → 遍历相关实体/块/社区（通常 2 跳） |
| **全局搜索** | 广泛主题问题 | 查询社区摘要 → 每个社区生成部分答案 → 汇总为最终回答 |

- 全局搜索针对社区摘要而非原始文本，覆盖全语料而无需将所有内容放入上下文
- 在处理需要全局理解的查询（~1M token 数据集）时，在全面性和多样性上显著优于传统 RAG

**HybridRAG**（Sarmah et al., 2024, arXiv:2408.04948）：
- 系统性地将 VectorRAG 和 GraphRAG 的检索结果合并
- VectorRAG 提供广泛的相似性检索，GraphRAG 提供结构化的关系上下文
- 在金融文档（财报电话会议记录）上的实验显示：
  - HybridRAG 答案相关性得分 0.96（最高）
  - HybridRAG 和 VectorRAG 均达到上下文召回分数 1.0
  - 综合表现优于单独使用 VectorRAG 或 GraphRAG

**OG-RAG（Ontology-Grounded RAG）**（Sharma et al., 2024, arXiv:2412.15235）：
- 使用**超图（Hypergraph）**表示文档，每个超边封装基于领域本体的事实知识簇
- 本体定义实体和关系，用于约束知识提取
- **量化改进**（vs 基线 RAG）：
  - 准确事实召回率提升 **55%**
  - 回答正确性提升 **40%**
  - 响应归因速度提升 **30%**
  - 基于事实的推理准确率提升 **27%**
- 目标领域：医疗、法律、农业的工业工作流，新闻、咨询、研究的知识工作

> 参考：[HybridRAG 论文](https://arxiv.org/abs/2408.04948)、[OG-RAG 论文](https://arxiv.org/html/2412.15235v1)

### 3.4 Neo4j LLM Knowledge Graph Builder

Neo4j 提供了完整的 GraphRAG Python 包，支持从非结构化文本到知识图谱的全流程。

**核心检索器（Retrievers）**：

| 检索器 | 机制 | 适用场景 |
|--------|------|----------|
| **HybridRetriever** | 同时使用向量索引和全文索引，归一化分数后合并排序 | 综合检索 |
| **VectorCypherRetriever** | 向量搜索 + Cypher 图查询 | 语义搜索 + 图遍历 |
| **HybridCypherRetriever** | 混合搜索 + Cypher 图遍历 | 最复杂的多跳查询 |

**Pipeline**：非结构化文本 → 实体提取 → 嵌入生成 → Neo4j 图创建 → 检索器查询

**从图数据库到本体**的演进路径：Ontology-grounded KG Construction（arXiv:2412.20942）展示了如何使用 LLM 在 Wikidata Schema 约束下从非结构化文档自动构建知识图谱，包括：
1. 通过生成 Competency Questions 发现知识范围
2. 从 CQ 中提取关系并映射到 Wikidata
3. 在本体约束下生成知识图谱

> 参考：[Neo4j GraphRAG Python Package](https://neo4j.com/developer/genai-ecosystem/graphrag-python/)、[Ontology-grounded KG 论文](https://arxiv.org/abs/2412.20942)

### 3.5 多模态知识图谱（MMKG）

多模态知识图谱是知识图谱领域的前沿研究方向。

**定义**：MMKG 扩展了传统知识图谱，在节点和边中融入图像、音频、视频等多模态数据，节点可携带多模态表征，边可编码感知特征。

**研究方向**：
- **KG4MM**：知识图谱赋能多模态学习
- **MM4KG**：多模态数据赋能知识图谱构建和补全

**关键进展**：

- **VaLiK**（ICCV 2025）：无需人工标注的多模态知识图谱构建框架
  - 使用预训练的视觉-语言模型（VLM）级联，将图像特征与文本对齐
  - 跨模态相似性验证机制过滤噪声
  - 在存储效率上显著优于传统 MMKG 构建方法

- **四大基础挑战**：表征（Representation）、融合（Fusion）、对齐（Alignment）、转换（Translation）

> 参考：[KG-MM Survey](https://github.com/zjukg/KG-MM-Survey)、[MMKG 综述](https://dl.acm.org/doi/10.1145/3656579)

### 3.6 "本体即护栏"模式的行业共识

2024-2025 年，行业在"本体作为 AI Agent 护栏"上形成了广泛共识。

**核心观点**（来自 VentureBeat、Galaxy、Salesforce 等）：

> "Ontology is the real guardrail: How to stop AI agents from misunderstanding your business" — VentureBeat

- 语义层将复杂数据翻译为业务术语（"收入"、"活跃客户"在所有地方含义一致）
- 本体是更正式的语义层，具有清晰的定义和关系
- Agent 通过本体获得可靠的领域地图，回答基于共享定义而非猜测
- 企业将工具和数据端点通过治理 API 注册，护栏定义 Agent 可以读取、写入或触发什么
- 图 + RAG 协同：Agent 先查询图中的事实，基准测试显示 QA 准确率从约 16% 跃升至约 54%

**Microsoft 的验证**：Fabric IQ 的语义本体标准为其 IQ 层实现了层次化知识表示和类特定约束，使 AI 模型能够一致地处理结构化和非结构化数据。

**Graphiti / Zep：时序知识图谱作为 Agent 记忆和护栏**（arXiv:2501.13956, 2025.01）：
- **双时序数据模型**：同时追踪事件时间和摄取时间，支持时间点查询（"Agent 在某日期知道什么？"）
- **实时增量更新**：新事实立即集成，无需批量重计算
- **混合检索**：语义嵌入 + BM25 关键词 + 直接图遍历；P95 延迟 300ms
- **事实失效**：当事实变化时（如"CEO 从 Alice 变为 Bob"），旧事实被标记为过期而非删除

> 参考：[VentureBeat: Ontology as Guardrail](https://venturebeat.com/infrastructure/ontology-is-the-real-guardrail-how-to-stop-ai-agents-from-misunderstanding)、[Galaxy: Enterprise Ontology](https://www.getgalaxy.io/articles/enterprise-ontology-ai-semantic-backbone)、[Graphiti GitHub](https://github.com/getzep/graphiti)

---

## 4. 技术架构模式

基于以上调研，可以提炼出以下技术架构模式。

### 4.1 四层架构：存储层→本体层→提取层→检索层

```
┌─────────────────────────────────────────────────────────────┐
│                      检索层（Retrieval）                      │
│  向量搜索 │ 关键词搜索 │ 图遍历 │ 混合搜索(RRF) │ HyDE      │
├─────────────────────────────────────────────────────────────┤
│                      提取层（Extraction）                     │
│  文本提取 │ 分块 │ 嵌入生成 │ 实体/关系提取 │ 元数据提取    │
├─────────────────────────────────────────────────────────────┤
│                      本体层（Ontology）                       │
│  对象类型 │ 属性（含 Vector/Media Ref）│ 链接类型 │ 函数       │
├─────────────────────────────────────────────────────────────┤
│                      存储层（Storage）                        │
│  表格数据集 │ 媒体集（Media Set）│ 向量索引 │ 图索引         │
└─────────────────────────────────────────────────────────────┘
```

**各层职责**：

- **存储层**：管理原始数据的物理存储，包括表格数据集和媒体集
- **本体层**：定义业务语义模型，对象类型的属性包含标量属性、Vector 属性和 Media Reference 属性
- **提取层**：将非结构化数据转化为可被本体管理的结构化表征（文本块、嵌入向量、提取的实体和关系）
- **检索层**：为 Agent/LLM 提供多种检索策略

### 4.2 AI 驱动的本体映射

传统模式下，本体由人工设计和维护。新兴模式引入 AI 自动化：

```
非结构化文档 → LLM 提取实体/关系 → 本体 Schema 约束验证 → 知识图谱生成
```

**关键步骤**：
1. LLM 从文档中提取候选实体和关系
2. 本体 Schema 作为约束：只接受符合预定义对象类型和链接类型的提取结果
3. 实体消解：将提取的实体映射到已有的对象实例
4. 增量更新：新知识被持续融入本体

**Palantir 的实现**：Object Data Funnel 服务从数据源读取数据，将其索引到对象数据库中，并在底层数据源更新时保持同步。

### 4.3 "本体即护栏"模式

本体在 Agent 系统中扮演三重角色：

```
┌──────────────────────────────────────┐
│           本体（Ontology）            │
│                                      │
│  ① 数据护栏：定义 Agent 可访问什么     │
│  ② 语义护栏：定义术语的唯一含义        │
│  ③ 行为护栏：定义 Agent 可执行什么     │
│                                      │
│     ┌──────────┐  ┌──────────┐      │
│     │结构型本体  │  │描述型本体  │      │
│     │(数据+关系) │  │(规则+约束) │      │
│     └──────────┘  └──────────┘      │
└──────────────────────────────────────┘
         │                │
         ▼                ▼
  ┌─────────────┐  ┌─────────────┐
  │ Agent 知道   │  │ Agent 知道   │
  │ 什么数据存在  │  │ 什么行为被允许│
  └─────────────┘  └─────────────┘
```

**实现要点**：
- 本体元数据注入 LLM 系统提示词，Agent 据此决定调用什么工具、查询什么对象
- LLM 不直接访问工具，而是请求工具使用，平台在用户权限范围内执行
- 每个工具调用都有本体定义的描述，引导模型在正确的时机调用正确的操作

---

## 5. Open Ontology 现状差距分析

### 5.1 差距总结

| 维度 | 行业最佳实践 | Open Ontology 现状 | 差距等级 |
|------|------------|-------------------|---------|
| **数据源类型** | 表格数据集 + 媒体集 + 流数据 | 仅表格数据集 | 🔴 关键 |
| **Media Reference 属性** | 完整规格：指向媒体集项、预览、API | 类型表中有名称，零规格 | 🔴 关键 |
| **Attachment 属性** | 完整的二进制内容管理 | 类型表中有名称，零规格 | 🟡 重要 |
| **Vector 属性** | 维度、元素类型、相似性搜索、索引 | 类型表中有名称，零规格 | 🔴 关键 |
| **Media Set 数据源** | 一等公民数据源类型 | 完全不存在 | 🔴 关键 |
| **文档处理 Pipeline** | 提取→分块→嵌入→入本体 | 完全不存在 | 🟡 重要 |
| **语义搜索** | 向量搜索 + 关键词搜索 + 混合搜索 | 完全不存在 | 🟡 重要 |
| **Agent 上下文架构** | Ontology Context + Document Context + Function-backed | 未涉及 | 🟡 中期 |
| **OAG 模式** | 本体驱动的生成，结构化对象作为上下文 | 未涉及 | 🟡 中期 |
| **本体即护栏** | 结构型 + 描述型双本体治理 Agent | 未涉及 | 🟢 长期 |

### 5.2 详细分析

#### 5.2.1 数据层完全面向表格

当前设计中：
> "数据集通常表示类似电子表格中的表格数据"
> "对象层会把存储在表格型数据集中的数据（行与列）转换为一组概念体系"

这意味着：
- 对象类型只能由表格数据集支撑
- 链接类型只能通过 JOIN 表（外键/主键列映射）实现
- 没有非表格数据源（Blob Store、文档库、对象存储）的概念

#### 5.2.2 Attachment / Media Reference 有定义无规格

`supported-property-types.md` 中，Media Reference 和 Attachment 出现在类型有效性表中（不可作为 Title Key 或 Primary Key），但：
- 未定义 Media Reference 指向什么（URL？Blob RID？Media Store？）
- 未定义 Attachment 的存储和引用机制
- 未定义 UI 渲染行为
- 未定义 API 语义
- 未定义写回（Writeback）语义

#### 5.2.3 无非结构化数据摄取路径

当前规格中没有以下概念：
- 从文档/图片/音频中提取文本或元数据
- 将提取结果作为对象属性入本体
- 文档分块和嵌入生成的 Pipeline

#### 5.2.4 Vector 类型无配套 Pipeline

Vector 被列为支持的静态属性类型，但缺少：
- 维度数量约束
- 支持的元素类型（float32、float64 等）
- 向量相似性搜索是否为平台级能力
- 如何从内容生成嵌入（嵌入模型配置）
- 向量属性的存储后端是否与标量属性不同

#### 5.2.5 Agent 上下文架构未涉及非结构化数据

`0 概念定义.md` 中虽然提到了 Function-backed Properties（Python/ML 模型支持），理论上可以支持实时嵌入或内容提取，但没有将其与非结构化数据或媒体类型关联的规格。

---

## 6. 建议与路线图

### 6.1 短期（融入现有设计，v0.1.x - v0.2.0）

**目标**：在不改变核心架构的前提下，为非结构化数据支持奠定基础。

#### 6.1.1 完善 Media Reference 属性规格

| 项目 | 建议内容 |
|------|---------|
| 值格式 | URI 引用，格式为 `media://{media_set_rid}/{item_rid}` 或标准 URL |
| 存储语义 | 属性值存储为字符串引用，实际二进制内容由外部存储管理 |
| UI 行为 | 在对象详情页显示内联预览（图片缩略图、PDF 首页、视频帧） |
| API 行为 | 提供获取媒体内容的 API 端点 |
| 支持格式 | 至少支持：image/*、application/pdf、video/*、audio/* |

#### 6.1.2 完善 Attachment 属性规格

| 项目 | 建议内容 |
|------|---------|
| 与 Media Reference 的区别 | Attachment 为直接附件（小文件，内嵌存储），Media Reference 为引用（大文件，外部存储） |
| 大小限制 | 建议 Attachment 限制在 10MB 以内 |
| 支持格式 | 通用二进制，MIME type 声明 |

#### 6.1.3 完善 Vector 属性规格

| 项目 | 建议内容 |
|------|---------|
| 维度 | 可配置，常见值：384、768、1024、1536、3072 |
| 元素类型 | float32（默认）、float16（可选，节省存储） |
| 距离度量 | cosine（默认）、euclidean、dot_product |
| 索引类型 | HNSW（推荐默认）、IVF_FLAT |
| 标量量化 | 可选，减少存储和加速检索 |

#### 6.1.4 在规格中引入"数据源类型"概念

在 `specs/terminology.md` 中新增：

| 中文 | English | 描述 |
|------|---------|------|
| 数据源 | Data Source | 为对象类型提供数据的底层存储，包括表格数据集和媒体集 |
| 表格数据集 | Tabular Dataset | 行列结构的数据集，当前的主要数据源类型 |
| 媒体集 | Media Set | 非结构化媒体文件的集合，包括文档、图片、音频、视频 |

### 6.2 中期（构建 Pipeline，v0.3.0 - v0.5.0）

**目标**：构建从非结构化数据到本体的完整处理管道。

#### 6.2.1 媒体集（Media Set）数据源

- 定义 Media Set 作为一等数据源类型，与 Tabular Dataset 并列
- 支持格式：PDF、Word、图片（PNG/JPG/TIFF）、音频（MP3/WAV）、视频（MP4）、DICOM 等
- 元数据自动提取：文件名、大小、MIME type、创建时间等
- 底层存储：对接对象存储（S3/MinIO/OSS 等）

#### 6.2.2 文档处理 Pipeline

定义标准的文档处理管道：

```
Media Set ─→ 文本提取 ─→ 分块 ─→ 嵌入生成 ─→ Chunk 对象类型
   │              │          │         │              │
   │         (OCR/解析)  (固定/语义)  (嵌入模型)    (入本体)
   │                                                  │
   └──── Media Reference ─────────────────────────────┘
```

**Pipeline 配置项**：
- 文本提取器：PDF 解析、OCR、音频转录、视频字幕
- 分块策略：固定大小、语义分块、段落分块
- 嵌入模型：可插拔，支持 OpenAI、开源模型（BGE、M3E 等）
- 目标对象类型：自动创建或映射到已有对象类型

#### 6.2.3 平台级语义搜索

- 基于 Vector 属性的 KNN 搜索 API
- 基于文本属性的全文搜索 API
- 混合搜索（向量 + 全文 + RRF 融合）
- 搜索范围：可限定对象类型、属性、对象集

#### 6.2.4 Agent 上下文 API

定义 Agent 从本体获取上下文的标准接口：

```typescript
interface OntologyContext {
  // 固定对象集作为上下文
  staticObjects(objectSetRid: string, properties: string[]): ObjectContext;

  // 语义搜索获取相关对象
  semanticSearch(query: string, objectType: string, topK: number): ObjectContext;

  // 混合搜索
  hybridSearch(query: string, objectType: string, config: SearchConfig): ObjectContext;
}

interface DocumentContext {
  // 全文档上下文
  fullDocument(mediaRef: MediaReference): TextContext;

  // 相关块上下文
  relevantChunks(query: string, mediaSetRid: string, topK: number): TextContext;
}
```

### 6.3 长期（多模态 + 高级 Agent 支持，v1.0+）

**目标**：支持多模态知识图谱和高级 Agent 推理。

#### 6.3.1 多模态本体支持

- 图像属性的视觉特征嵌入（CLIP 等）
- 音频属性的语音嵌入
- 视频属性的时序嵌入
- 多模态实体对齐：同一实体在不同模态中的表征关联

#### 6.3.2 AI 驱动的本体映射

- LLM 从非结构化文档自动提取实体和关系
- 本体 Schema 作为约束验证提取结果
- 增量知识融入（实体消解 + 关系补全）
- 人在回路（Human-in-the-loop）审核和修正

#### 6.3.3 描述型本体（Agent 护栏）

借鉴 Salesforce 双本体模型：
- **结构型本体**（现有设计已涵盖）：对象类型、属性、链接类型
- **描述型本体**（新增）：
  - Agent 可执行的动作及其前置条件
  - 业务规则和合规约束
  - 决策逻辑和审批流程
  - 安全策略和权限边界

#### 6.3.4 OAG（本体增强生成）框架

将 Palantir OAG 模式内化：
- 本体元数据自动注入 Agent 系统提示词
- Agent 通过工具调用（而非直接数据库查询）访问本体
- 结构化对象（而非文本块）作为 LLM 上下文
- 引用追踪：每个 Agent 回答都可追溯到具体的对象和属性

---

## 附录 A：参考资料索引

### Palantir 官方文档（含补充）
- [Palantir Ontology Platform](https://www.palantir.com/platforms/ontology/)
- [Media Sets Core Concepts](https://www.palantir.com/docs/foundry/data-integration/media-sets)
- [Media in Ontology](https://www.palantir.com/docs/foundry/media-sets-advanced-formats/media-in-ontology)
- [Semantic Search / OAG](https://www.palantir.com/docs/foundry/ontology/ontology-augmented-generation)
- [Object Storage V2 Overview](https://www.palantir.com/docs/foundry/object-backend/overview)
- [AIP Agent Studio Overview](https://www.palantir.com/docs/foundry/agent-studio/overview)
- [AIP Agent Studio Retrieval Context](https://www.palantir.com/docs/foundry/agent-studio/retrieval-context)
- [AIP Agent Studio Core Concepts](https://www.palantir.com/docs/foundry/agent-studio/core-concepts)
- [AIP Agent Studio Tools](https://www.palantir.com/docs/foundry/agent-studio/tools)

### Palantir 博客
- [Building with Palantir AIP: Data Tools for RAG/OAG](https://blog.palantir.com/building-with-palantir-aip-data-tools-for-rag-oag-b3b509c8b0f3)
- [Building with Palantir AIP: Logic Tools for RAG/OAG](https://blog.palantir.com/building-with-palantir-aip-logic-tools-for-rag-oag-fdaf8938d02e)
- [Reducing Hallucinations with the Ontology in Palantir AIP](https://blog.palantir.com/reducing-hallucinations-with-the-ontology-in-palantir-aip-288552477383)

### Microsoft
- [From Data Platform to Intelligence Platform: Introducing Microsoft Fabric IQ](https://blog.fabric.microsoft.com/en-us/blog/from-data-platform-to-intelligence-platform-introducing-microsoft-fabric-iq)
- [Fabric IQ Overview](https://learn.microsoft.com/en-us/fabric/iq/overview)
- [Microsoft Adopts Ontology-Based IQ Layer for Agentic AI](https://www.softwarereviews.com/research/microsoft-adopts-ontology-based-iq-layer-for-agentic-ai)

### Salesforce
- [Two Types of Ontologies Your AI Agents Need](https://www.salesforce.com/blog/structural-and-descriptive-ontology/)

### 学术论文
- [HybridRAG: Integrating Knowledge Graphs and Vector Retrieval (arXiv:2408.04948)](https://arxiv.org/abs/2408.04948)
- [OG-RAG: Ontology-Grounded RAG (arXiv:2412.15235)](https://arxiv.org/html/2412.15235v1)
- [Ontology-grounded KG Construction under Wikidata Schema (arXiv:2412.20942)](https://arxiv.org/abs/2412.20942)
- [VaLiK: Annotation-Free Multimodal KG Construction (ICCV 2025)](https://arxiv.org/abs/2503.12972)
- [Knowledge Graphs Meet Multi-Modal Learning: Survey](https://dl.acm.org/doi/10.1145/3656579)

### 行业分析与工具
- [VentureBeat: Ontology is the Real Guardrail](https://venturebeat.com/infrastructure/ontology-is-the-real-guardrail-how-to-stop-ai-agents-from-misunderstanding)
- [Galaxy: Enterprise Ontology for AI Agents](https://www.getgalaxy.io/articles/enterprise-ontology-ai-semantic-backbone)
- [Neo4j GraphRAG Python Package](https://neo4j.com/developer/genai-ecosystem/graphrag-python/)
- [Neo4j: Enhancing Hybrid Retrieval with Graph Traversal](https://neo4j.com/blog/developer/enhancing-hybrid-retrieval-graphrag-python-package/)
- [Neo4j LLM Knowledge Graph Builder](https://neo4j.com/labs/genai-ecosystem/llm-graph-builder/)
- [Microsoft GraphRAG GitHub](https://github.com/microsoft/graphrag)
- [Graphiti: Temporal Knowledge Graph (Zep)](https://github.com/getzep/graphiti)
- [Graphiti Paper (arXiv:2501.13956)](https://arxiv.org/abs/2501.13956)
- [Stardog: Enterprise AI Requires LLM+KG Fusion](https://www.stardog.com/blog/enterprise-ai-requires-the-fusion-of-llm-and-knowledge-graph/)
- [Salesforce Architects: Agentic Enterprise IT Architecture](https://architect.salesforce.com/fundamentals/agentic-enterprise-it-architecture)
- [GQL Standard (ISO/IEC 39075:2024)](https://www.iso.org/standard/76120.html)
