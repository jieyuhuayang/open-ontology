

# 一、背景

1. 本开源项目（Open Ontology）旨在实现适应 agent 时代的 Ontology，让不同业务与职能部门的用户以及基于大模型的 agent 共享一套标准业务术语，无需经历漫长的“对齐与核对”过程。

   1. 以**业务视角**为中心的**统一**世界观：屏蔽底层技术实现细节，全局整合真实世界的业务概念。推动企业使用统一、通用的业务语言，让业务人员和 agent 都能一致地理解和操作数据。

   2. 企业的每个决策都可以分解为**data**, **logic**, **action 和** **security**.，都可以被记录在系统中。

2. 本版本是 Open Ontology 的 0.1.0 版本，也是 MVP 版本，目标是实现本体管理平台（Ontology Manager）的基础功能，支持本体的创建、编辑、搜索和删除，为后续高阶功能打下良好的基础。

# 二、目标及优先级

<table>
<thead>
<tr>
<th>优先级</th>
<th>目标</th>
</tr>
</thead>
<tbody>
<tr>
<td>P0</td>
<td><ol>
<li>用户界面整体框架</li>
<li>对象类型的创建、编辑和删除</li>
<li>链接类型的创建、编辑和删除</li>
<li>本体搜索</li>
<li>本体变更管理</li>
</ol></td>
</tr>
<tr>
<td>P1</td>
<td><ol>
<li>对象属性的值格式化 </li>
<li>对象支撑链接</li>
<li>对象类型的复制</li>
<li>本体导入和导出</li>
<li>数据连接管理（Data Connection）— 详见独立 PRD《数据连接（Data Connection）PRD.md》</li>
</ol></td>
</tr>
<tr>
<td>P2（本期不做）</td>
<td><ol>
<li>发现页视图支持自定义配置</li>
<li>对象类型分组功能</li>
<li>共享属性</li>
<li>动作类型的的创建、编辑和删除</li>
</ol></td>
</tr>
</tbody>
</table>

# 三、功能需求说明

> **本体管理平台**用于构建和维护你所在组织的本体。你可以用本体管理平台完成本体相关的工作：从创建新的**对象类型**、定义新的**动作类型**，到将数据连接到本体，以及排查用户应用中的数据是否在持续更新。

## 1. 用户界面

本程序部署运行以后，通过固定 URL 可以访问本体管理平台界面。

本体管理平台界面由以下元素组成（后续文档会反复引用这些元素）：

* 本体管理平台导航

* 发现页视图

* 对象类型视图

* 属性编辑器视图

* 链接类型视图

* 动作类型视图

* 函数类型视图


### 1.1 本体管理平台导航

本体管理平台中有两个始终存在的界面元素：**顶部栏（top bar）和侧边栏（sidebar）**。顶部栏与侧边栏作为导航组件，为你在应用内访问各类特性、功能与页面提供直观入口。

顶部栏包含三个主要功能：用于搜索本体资源、创建新的本体资源，以及在不同分支之间导航或创建新的分支。

侧边栏用于在 Ontology Manager 内的不同资源、页面或应用之间快速跳转。

![](<images/本体管理平台（Ontology Manager） PRD-image-8.png>)

### 1.2 发现页视图

发现页提供一个高度可自定义的 landing page，可根据用户的偏好进行个性化配置。默认情况下，Discover 视图会展示**收藏的对象类型**、**最近查看的对象类型**以及**收藏的组**。

![](<images/本体管理平台（Ontology Manager） PRD-image-7.png>)

Discover 视图支持灵活配置页面上展示的版块，并可控制每个版块显示的条目数量。可用版块包括 **“最近查看的对象类型”**、**“收藏的对象类型”** 和 **“收藏的组”**。此外，你还可以为某个特定的组单独添加一个版块，从而浏览该组内的全部对象类型。

![](<images/本体管理平台（Ontology Manager） PRD-image.png>)

![](<images/本体管理平台（Ontology Manager） PRD-image-1.png>)

### 1.3 对象类型视图

选择一个对象类型会打开对象类型视图，该视图包含以下组件：

* 用于选择页面的侧边栏（如下图左侧）

* 当前选中的页面内容区（如下图右侧）

![](<images/本体管理平台（Ontology Manager） PRD-image-2.png>)

对象类型的 **Overview（概览）** 页面包含以下版块（对应下图编号）：

1. 对象类型元数据

2. 属性

3. 动作类型

4. 链接类型图（link type graph）

5. 依赖项（Dependents）

6. 数据

7. 使用情况（Usage，本期不做）

![](<images/本体管理平台（Ontology Manager） PRD-image-3.png>)

### 1.4 属性编辑器视图

在对象类型 **Overview（概览）** 页面的 **Properties（属性）** 区域中选择某个属性，即可打开应用的属性编辑器视图。

![](<images/本体管理平台（Ontology Manager） PRD-ClTBbvuALoRB4HxfGhAc5TIRnjd.png>)

### 1.5 链接类型视图

在对象类型 **Overview（概览）** 标签页的链接类型图中选择某个链接类型（见下图），会打开链接类型视图（包含 **Overview（概览）** 和 **Datasets（数据集）** 页面）。

![](<images/本体管理平台（Ontology Manager） PRD-JuhBbI4ODoazJhxQZl2cBoqHnhb.png>)

***

### 1.6 动作类型视图

在对象类型 **Overview（概览）** 标签页的动作类型区域中选择某个动作类型，会打开动作类型视图，并可进一步访问 **Overview（概览）**、**Logic（逻辑）** 与 **Observability（可观测性）** 页面。

![](<images/本体管理平台（Ontology Manager） PRD-IvCobuT3Qop1Eqx6oCTcWixmn2K.png>)

##### 1.6.1 查看动作指标与监控规则（本期不做）

**Observability（可观测性）** 标签页会展示过去 30 天内该动作的近实时使用情况（usage），以及为该动作定义的任何监控规则（monitoring rules）及其状态。

![](<images/本体管理平台（Ontology Manager） PRD-R3mibn4WXo6ZakxRnO0cDF1wnYg.png>)

### 1.7 函数类型视图

在对象类型 **Overview（概览）** 标签页的函数类型区域中选择某个函数类型，会打开函数类型视图，并可进一步访问 **Overview（概览）**、**Configuration（配置）** 与 **Observability（可观测性）** 页面。

##### 1.7.1 函数的使用历史

**Usage History（使用历史）** 面板会记录使用过任意版本该函数的应用，以及对应的版本信息。你可以从该面板跳转到这些应用，以升级所使用的函数版本。

##### 1.7.2 查看函数的历史版本

默认情况下会显示函数的最新版本。若要查看其他版本，请使用左侧面板中的版本下拉选择器。

##### 1.7.3 跳转到 Functions Code Repository（函数代码仓库）

对函数的修改只能在**函数代码仓库**中完成。要跳转到该仓库，请使用实体视图右上角的 **Open in Code Repository（在代码仓库中打开）** 按钮。

![](<images/本体管理平台（Ontology Manager） PRD-RyAkbrppSo0tFOxvM1UcHI1CnQe.png>)

##### 1.7.4 查看函数指标与监控规则

**Observability（可观测性）** 标签页会展示过去 30 天内该函数的近实时使用情况（usage），以及为该函数定义的任何监控规则及其状态。关于函数监控规则的详细配置选项，请参阅函数规则（function rules）。

![](<images/本体管理平台（Ontology Manager） PRD-V0CpbubatohWm8xq5RccGdP3nof.png>)





## 2. 对象类型管理

#### 2.1 创建对象类型

创建并配置一个新对象类型的主要方式有 2 种：

1. 使用**分步向导（推荐方式）**。

2. 手动创建。如果你在完成对象类型创建流程之前退出向导，后续可以通过手动创建为新对象类型指定元数据（metadata）、底层数据集（backing dataset）、属性映射（property mappings）以及键（主键 primary key 与标题键 title key）。

创建新对象类型后，你可以将其 API 名称从系统分配的默认值修改为自定义值。

##### 2.1.1  使用分步向导创建新的对象类型

1. 创建新的对象类型

要创建新的对象类型，可从 Ontology Manager 首页选择 **创建你的第一个对象类型**，或在同一页面右上角选择 **创建 > 创建对象类型**。

![](<images/本体管理平台（Ontology Manager） PRD-image-4.png>)

此时会出现 创建新对象类型 分步向导：

![](<images/本体管理平台（Ontology Manager） PRD-image-5.png>)

2. 选择底层数据集

如果你已有包含该对象类型数据的 Dataset（数据集），可以从平台内已有的 Dataset 中选择。系统将自动填充对象类型的元数据；同时会将底层数据集的每一列自动映射为一个属性（property），但你可以在属性（**Properties**）步骤中删除不需要的已添加属性。

如果你没有包含该对象类型数据的已有数据集，可以选择在没有数据集的情况下继续（Continue without dataset）。如需导入新数据，请前往 **Data Connection** 模块完成数据导入后再返回选择。

![](<images/本体管理平台（Ontology Manager） PRD-image-6.png>)




##### 2.1.1.1 数据集选择详细交互

用户选择 **"Use existing dataset（使用已有数据集）"** 后，展开数据集选择面板。面板展示平台内已有的 Dataset 列表供用户选择。

**整体布局：**

```
┌─────────────────────────────────────────────────┐
│  选择底层数据集（Select Backing Dataset）            │
├─────────────────────────────────────────────────┤
│  ┌─ A. 已有数据集 ─────────────────────────┐    │
│  │  [🔍 搜索数据集...]                       │    │
│  │  ┌──────────────────────────────────────┐│    │
│  │  │ 名称          │ 来源  │ 行数 │ 列数  ││    │
│  │  │ orders_2024   │ MySQL │ 12K │ 15    ││    │
│  │  │ employees ⚠️  │ MySQL │ 500 │ 8     ││    │
│  │  │  In use (已被关联)                    ││    │
│  │  └──────────────────────────────────────┘│    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  [Continue without dataset]                       │
│                                                   │
│  💡 需要导入新数据？请前往 Data Connection 模块    │
└───────────────────────────────────────────────────┘
```

---

**A. 已有数据集列表**

当平台内已存在导入过的 Dataset 时，以列表形式展示：

| 列 | 说明 |
|-----|------|
| 名称（Name） | Dataset 的 display name |
| 来源（Source） | 数据来源标识：`MySQL`、`Excel`、`CSV` |
| 行数（Rows） | 数据行数，超过 1000 时以 `K` 为单位缩写（如 `12K`） |
| 列数（Columns） | 数据列数 |
| 导入时间（Imported At） | 导入时间，展示相对时间（如 "3 天前"） |

**交互规则：**
- 列表顶部提供搜索框，支持按 Dataset 名称模糊过滤
- 已被其他 Object Type 关联（作为 backing dataset）的 Dataset，显示 **"In use"** 标签，行置灰且不可选择（点击时 Tooltip 提示"该数据集已被 \<ObjectTypeName\> 关联"）
- 选中某行后，列表下方展开**列结构预览 + 数据预览**区域：
  - 列结构表格：列名、推断类型、是否可为 NULL
  - 数据预览：前 **5 行**数据，只读表格形式
- 选中后点击 **"Use this Dataset"** 按钮确认，进入向导下一步

---

3. 设置元数据（Object type metadata）

在此步骤中，为你的新对象类型提供以下信息：

  * **图标Icon**：选择默认图标以自定义对象类型的图标与颜色；当用户在用户应用（user applications）中查看该类型对象时，会显示此图标与颜色。

  * **名称**：在用户应用中，任何访问该类型对象的用户看到的名称。

  * **描述**：面向用户应用中访问该类型对象的用户的说明文本。例如，用户在 Object Explorer 中搜索时，会在搜索结果里看到对象类型的描述。

  * **分组（Groups，本期不做）**：~~选择该对象类型是否属于某些分组。分组是一种组织 Ontology 的机制，便于你后续筛选并定位想要处理的对象类型。~~

  ![](<images/本体管理平台（Ontology Manager） PRD-image-9.png>)

4. 为对象类型添加属性

在分步向导对话框的第三步，管理员可以自定义该对象类型拥有哪些属性（支持的属性类型列表可参见《Supported property types》）。如果你选择了已有数据集，其列会自动完成映射，但你可以在此步骤中删除它们。

在 **Properties**（属性）步骤中，管理需要选择主键与标题键：

   * **标题键（Title key）**：作为该类型对象展示名称（display name）的属性。

     > 例如，将 `Employee` 对象类型的 `full name` 属性选为标题键，则会使用该属性的值（如 “Melissa Chang”、“Akriti Patel”）作为对应（假设）`Employee` 对象的展示名称。

   * **主键（Primary key）**：用于唯一标识该对象类型每个实例的属性。底层数据集中每一行在该属性上必须拥有不同的值。

     * 主键旁边需要有 toollip 提示用户在分配主键之前务必检查底层数据集中是否存在重复值，主键必须对数据集中的每条记录都唯一。

     > 例如，`employee ID` 属性的值将用于在组织内将 “Melissa Chang” 标识为一个唯一员工。

向导允许你添加任何其他需要的属性。但是需要高级配置的属性类型（例如媒体 media）无法在该初始化向导中生成，必须在退出向导后再添加。

![](<images/本体管理平台（Ontology Manager） PRD-G7xlbRK2Uo9nMYxyjFMcO23Onrc.png>)

5. 添加动作类型（Generate actions types）

Action Type 的“逻辑”是通过 **Rules（规则）** 来定义的；官方定义里，Action 是一次事务，Action type 是一套“要改哪些对象/属性/链接 + 提交时的副作用/校验”的定义。

管理员可以选择性地添加一组标准动作类型（3 个 checkbox 勾选项：Create / Modify / Delete），用于编辑该类型对象，并指定允许运行这些动作的特定用户或用户组。

> 注意：即使已完成对象类型并退出向导，仍然可以编辑这些动作或新增更多动作。

![](<images/本体管理平台（Ontology Manager） PRD-RJotbuSqloAieWxinJXcNTpVnSc.png>)

   1. Create \<ObjectType>： 默认会放一条 **Create object** 规则，把“创建时要填写的属性”（默认是所有属性）加进规则里。

   2. Modify \<ObjectType>：默认会放一条 **Modify object&#x20;**&#x89C4;则，把该对象类型的 **非 primary key 属性**都加入到 Modify rule 里。

   3. Delete \<ObjectType> ：默认会放一条 **Delete object&#x20;**&#x89C4;则，删除由对象引用参数定位到的对象实例。   
   
      

6. 保存位置（Save location）确认

在最后一步，选择一个项目（project）用于保存该对象类型，然后选择 **创建**。选择 **创建** 只会暂存（stage）你的变更，**不会真正保存**。

![](<images/本体管理平台（Ontology Manager） PRD-OuAhbKaZToxywHxJDijcGJ3nnwb.png>)

7. 保存变更到本体

回到 Ontology Manager 后，在右上角选择 **保存，详见保存对本体的修改。**

![](<images/本体管理平台（Ontology Manager） PRD-image-10.png>)

##### 2.1.2  手动创建新的对象类型

使用分步向导创建对象类型时，如果未完成所有步骤之前就选择 创建，那么会退出向导，并概览（overview） 页面。

此时，对象类型处于未保存状态，且在完成以下所有步骤之前无法保存：

1. 为新对象类型添加底层数据集（Add a backing dataset to a new object type）。可以按以下方式操作：

   1. 在概览页面的 属性 区域选择 新建（Create new），进入属性编辑器；或在对象类型视图侧边栏的 属性 页面选择 编辑属性映射。

   2. 然后选择下图所示的 添加底层数据集（Add a backing dataset）按钮，从平台内已有 Dataset 中选择作为底层数据集。如需导入新数据，请前往 **Data Connection** 模块。

      * 注意：同一个数据集只能用于底层一个对象类型。

![](<images/本体管理平台（Ontology Manager） PRD-ZlfAb80UioOxhAxHssicBc9Xnwh.png>)

* 为新对象类型添加元数据（Add metadata for a new object type）

在概览页面的元数据区域，可以编辑对象类型的展示名称描述与 ID：

1. **Display name（展示名称）**：在用户应用中，任何访问该类型对象的用户看到的名称。

2. **Aliases（别名）**：用户搜索这些额外术语时，也能找到该对象类型。

3. **Description（描述）**：面向用户应用中访问该类型对象的用户的说明文本。例如，用户在 Object Explorer 中搜索时，会在搜索结果里看到对象类型的描述。

4. **Groups（分组）**：一个或多个标签，用于对对象类型进行分类。

5. **ID**：对象类型的唯一标识符，主要用于在配置用户应用时引用该类型对象。

   * ID 可包含小写字母、数字与短横线（dashes）。

   * ID 的首字符**必须**是小写字母。

   * 一旦某属性的 ID 被保存且该属性已在用户应用中被引用，则对该属性 ID 的**任何**修改都会破坏应用。

6. **Icon（图标）**：在对象类型视图侧边栏选择默认图标，可自定义对象类型图标与颜色；当用户在用户应用中查看该类型对象时，会显示此图标与颜色。

7. **Backing dataset（底层数据集）**：作为该类型对象属性值来源的数据集。

![](<images/本体管理平台（Ontology Manager） PRD-OoEEbMOX3oEF6UxmI2ycmIecnBg.png>)

* 添加新属性（Add a new property）

在属性编辑器中，点击屏幕右侧属性面板里的添加，即可为对象类型添加新属性。

![](<images/本体管理平台（Ontology Manager） PRD-CVdUbDMnTotK8lxXfi4ciSD0nbb.png>)

* 将单个属性映射到底层数据

你可以通过以下任一种方式，将属性映射到底层数据集的列：

1. 将列映射为新属性

   在屏幕左侧的数据集面板（dataset pane）中，你可以看到数据集的所有列。将鼠标悬停在要映射的列上，选择”添加为新属性”按钮，即可创建一个映射到该列的新属性。属性 ID、展示名称与基础类型（base type）将根据列名推断生成。

   ![](<images/本体管理平台（Ontology Manager） PRD-FTS9b9nTyo8WztxlfGmcKForn0d.png>)

2. 将列映射到已有属性

   在屏幕左侧的数据集面板中，悬停在一个未映射列上并选择”添加为已有属性”。如果已存在某个属性，其属性 ID 与该列名匹配，则该列会被映射到该现有属性。

3. 将属性映射到列

   在屏幕右侧的属性面板，将鼠标悬停在要映射的属性上并选择“映射到列”。随后会出现下拉列表，你可以选择要映射到该属性的列。

   ![](<images/本体管理平台（Ontology Manager） PRD-O0AnbYUYuo0xVMxnckNcel8knCg.png>)

4. 将所有未映射列映射为新属性

   在数据集面板中、数据集名称旁边，你会看到 “将所有未映射列添加为新属性”按钮。点击后，会为数据集中所有未映射列创建属性。属性的 ID、展示名称与基础类型将根据对应列推断生成。

   * 一旦某属性的 ID 被保存且该属性已在用户应用中被引用，则对该属性 ID 的**任何**修改都会破坏应用。

     ![](<images/本体管理平台（Ontology Manager） PRD-Ivfcb1AaconEZmxQMwScCxn9nuf.png>)

5. 配置主键与标题键

在属性编辑器中进入属性元数据面板（property metadata pane）（如下图），将某个属性设置为该对象类型的主键与标题键：

* **标题键（Title key）**：作为该类型对象展示名称的属性。

* **主键（Primary key）**：用于唯一标识该对象类型每个实例的属性。底层数据集中每一行在该属性上必须拥有不同的值。

  * 主键旁边需要有 toollip 提示用户在分配主键之前务必检查底层数据集中是否存在重复值，主键必须对数据集中的每条记录都唯一。

![](<images/本体管理平台（Ontology Manager） PRD-OCoXb4EB0oG1BJxkSwLcxdyhnof.png>)

##### 2.1.3 配置 API 名称

~~API 名称（API name）是指在代码中以编程方式引用对象类型或属性时使用的名称。所有新对象类型与属性都会自动获得从其显示名称推断生成的 API 名称。~~

~~你可以按如下方式修改自动分配的 API 名称：~~

* ~~可在对象类型的 **Overview** 页面编辑对象类型的 API 名称。~~

* ~~可在属性编辑器的属性面板（properties pane）中编辑属性的 API 名称。~~



~~对象类型的 API 名称遵循函数式编码标准命名规范：~~

* ~~以大写字母开头，且仅由字母数字字符（alphanumeric characters）组成；~~

* ~~使用 PascalCase（也称 UpperCamelCase：复合词中每个单词首字母大写，例如 “ThisExampleName”）；~~

* ~~在所有对象类型中保持唯一。~~

![](<images/本体管理平台（Ontology Manager） PRD-L8u2by0VQo1Sraxh0W7cDME3n9c.png>)

~~属性的 API 名称必须：~~

* ~~以小写字母开头，且仅由字母数字字符组成；~~

* ~~使用 camelCase（首词首字母小写，之后每个单词首字母大写，例如 “thisExampleName”）；~~

* ~~在同一对象类型的所有属性中保持唯一。~~

![](<images/本体管理平台（Ontology Manager） PRD-BBhqb7mc2otEh9xLeWKcDvaPnub.png>)



##### 2.1.4 本体保存校验逻辑

1. 必填对象类型字段

   要保存一个新对象类型，下列对象类型字段不能为空：

   * ID

   * Display name（展示名称）

   * Backing dataset（支撑数据集）

   * API name

   此外，下列属性字段不能为空：

   * Property ID（属性 ID）

   * Property display name（属性展示名称）

   * Backing column（底层列/映射列）

   * Property API name（属性 API 名称）

   * Title key（标题键）

   * Primary key（主键）

2. 有效 ID 检查清单（Valid ID checklist）

   1. 对象类型 ID（Object type ID）

      对象类型 ID：

      * 可由小写字母、数字与短横线组成；

      * 应以字母开头；

      * 必须在所有对象类型中保持唯一。

   2. 属性类型 ID（Property type ID）

      属性类型 ID：

      * 可由小写或大写字母、数字、短横线与下划线组成；

      * 应以字母开头；

      * 必须在同一对象类型的所有属性中保持唯一。

3. API 名称（API name）

   依据函数式编码标准，对象类型 API 名称必须：

   * 仅由字母数字字符与下划线（underscores）组成；

   * 在所有对象类型中保持唯一。

   属性 API 名称必须：

   * 是有效 Unicode；

   * 在同一对象类型的所有属性中保持唯一。

   注意：有一些保留关键字不能用作 API 名称，分别是：`ontology`、`object`、`property`、`link`、`relation`、`rid`、`primaryKey`、`typeId`、`ontologyObject`。

4. 错误（Errors）

* 错误：`DatasetAndBranchAlreadyRegistered`

如果你收到错误 `DatasetAndBranchAlreadyRegistered`，表示你尝试保存的对象类型所使用的底层数据集，已经被 Ontology 中另一个对象类型占用，无法重复使用。



#### 2.2 编辑对象类型

##### 2.2.1 进入一个存量对象类型

当前正在处理的对象类型支持切换：

* 在首页侧边栏中选择对象类型页面，然后从列表中选择另一个对象类型。

* 也可以在应用顶部栏的搜索框中搜索并打开新的对象类型。

##### 2.2.2 删除对象类型

你可以在对象类型视图侧边栏右上角选择 “三点”图标，然后在下拉菜单中选择删除。系统会弹出对话框，确认“是否要删除该对象类型及其所有关联的链接类型”

* 注意：对象类型的删除只有在保存对本体的修改之后才会生效，并且会破坏所有引用该对象类型的视图或应用。

* 状态为 `active` 的对象类型无法删除。

![](<images/本体管理平台（Ontology Manager） PRD-ZoCHbIEuyoma8hxG3X5cMR06nkf.png>)

##### 2.2.3 更改底层数据集

你可以按以下步骤更改底层数据集：

1. 在对象类型的**属性**页面顶部选择”**编辑属性映射**”，进入属性编辑器。

2. 在 **数据集（Datasets）** 面板顶部选择 “替换”按钮。随后你可以浏览并选择可用的数据集。

![](<images/本体管理平台（Ontology Manager） PRD-ZQnabIZpMoFxfAxKetpcjlNenCf.png>)

> 更改对象类型的底层数据集会移除旧数据集列与对象类型属性之间的所有连接。只有在你切换到一个与旧数据集 **schema 相同**的新数据集时，系统才会为你自动重新映射属性；否则，你需要手动将对象类型属性重新映射到新数据集。

![](<images/本体管理平台（Ontology Manager） PRD-GvA0bEeePo991NxFLV6cUEKgnpg.png>)

##### 2.2.4 编辑对象类型的元数据

![](<images/本体管理平台（Ontology Manager） PRD-VgPQbsMBSomR9SxoGHUcZWE4neg.png>)

1. **图标（Icon）：** 选择默认图标以自定义对象类型的图标与颜色；当用户在应用中查看此类型的对象时，会显示该图标与颜色。

2. **展示名称与描述（Display names and description）：** 选中当前展示名称或描述以编辑文本。

3. **状态（Status）：**  选择当前状态以打开可用状态下拉框。可选状态包括`deprecated`、`experimental`和`active`：

4) **可见性（Visibility）：** 选择当前可见性以打开可用可见性下拉框。`可见`（`prominent`） 的对象类型会引导应用优先向用户展示该类型；`隐藏`（`hidden`） 的对象类型不会出现在用户应用中。

5) **API 名称（API name）：**  在现有 API 名称处编辑以修改其值。 &#x20;

* 注意：

  * 状态为`active`的对象类型不能更改 API 名称。

  * 对象类型的对象 ID（object ID）在对象类型初次创建完成后无法再编辑。

##### 2.2.5 本体保存逻辑校验

* 错误：`FoundryColumnNameNotFound`

如果出现 `FoundryColumnNameNotFound`，说明你正尝试保存的对象类型，其底层数据集中有一列已被移除，导致某个属性处于未映射（unmapped）状态。该属性需要被重新映射或删除。

* 错误：`InvalidColumnRemoval`

如果出现 `InvalidColumnRemoval`，说明被移除的列曾作为某个”已接收过编辑”的属性的底层支撑。你需要将该列加回数据集，或对对象类型执行注销并重新注册。

* 错误：`InvalidColumnFieldSchemaChange`

如果出现 `InvalidColumnFieldSchemaChange`，说明某个“已接收过编辑”的属性，其 ID 或键（key）发生了变更。你需要撤销该变更，或对对象类型执行注销并重新注册。

* 错误：`OntologyMetadata:IncompatibleFoundryFieldSchemaForPropertyType`

如果出现 `OntologyMetadata:IncompatibleFoundryFieldSchemaForPropertyType`，说明你尝试保存的属性，其基础类型（base type）与为其提供底层支撑的列类型不兼容。例如，数据集中列 X 的类型已变更为 “string”，但仍被映射到基础类型为 “integer” 的属性 X。

* 错误：`SchemaMismatch`

如果出现 `SchemaMismatch`，你很可能对支撑该对象的 schema 做了有意的变更，但尚未在 Ontology Manager 中更新对象属性类型。通过编辑属性的数据类型以接纳新类型来修改本体。发布更改并重建数据集，然后对该对象发起重新索引（re-index）。

* 错误：`FieldTypeIncompatibleWithOntologyPropertyType`

如果出现 `FieldTypeIncompatibleWithOntologyPropertyType`，或收到消息 “Failed to Update Object Type in Phonograph”，说明支撑对象的数据集中的数据类型与本体所期望的数据类型不一致。你必须确保任何 schema 更新同时反映在数据集与本体中。如果你确实对本体或数据集做了有意变更，请与该对象及其底层数据集的负责人沟通，以了解近期变更情况。



#### 2.3 复制对象类型配置

> 对象类型有时会具有相似的 schema 。例如，`Car` 与 `Truck` 的 schema 可能非常相近，只在少数属性上存在差异。为了减少你在配置 `Truck` 对象类型上花费的时间，你可以将 `Car` 对象类型的配置复制到 `Truck` 对象类型中。

##### 2.3.1 选择要复制的对象类型

你可以按以下步骤复制某个对象类型的配置：

1. 在对象类型视图的侧边栏右上角，选择“三个点”（更多）菜单。

2. 在下拉菜单中选择 **复制配置到另一个对象类型（Copy configuration to another object type）**。这将打开 “**复制对象类型配置**”**&#x20;**&#x5BF9;话框。

![](<images/本体管理平台（Ontology Manager） PRD-image-11.png>)

##### 2.3.2 复制对象类型配置

在 “**复制对象类型配置**”**&#x20;**&#x5BF9;话框中，你可以：

* 选择一个**已有对象类型**作为复制后的配置**目标对象类型**；

* **创建并命名**一个新的对象类型，并使用复制过来的对象类型配置。

![](<images/本体管理平台（Ontology Manager） PRD-image-12.png>)

点击“**确认**”将复制起始对象类型的**全部属性及其元数据**（例如：状态 *statuses*、渲染提示 *render hints* 等）。

> 注意：
>
> 如果选择的“复制目标”为**已有对象类型**，且该对象类型已经存在属性，则可能发生以下情况：
>
> * 目标对象类型上已有的属性可能会被起始对象类型复制过来的属性**覆盖**。
>
> * 如果目标对象类型的底层数据源（backing datasource）中存在列名与某个被复制属性的名称匹配，则这些被复制的属性会自动映射（mapped）到目标对象类型的底层数据源。
>
> 因此，当你选择一个已有对象类型作为复制目标时，请确保该目标对象类型与被复制的对象类型具有**相同的 schema（模式）**。



#### 2.4 编辑对象类型属性

##### 2.4.1 删除属性&#x20;

在属性编辑器中，在右侧属性面板（properties pane）里将鼠标悬停在想删除的属性上，然后选择“**删除属性**”。

注意：

* 属性的删除只有在**保存对本体的更改**后才会生效。

* 状态为 `active` 的属性**不能**被删除。

##### 2.4.2 更改属性所映射的底层数据列

在**属性编辑器**中，在属性面板里将鼠标悬停在想解除映射的属性上，然后选择“**解除属性链接**”。要将该属性链接到一个新的列上，将鼠标悬停在该属性上并选择“映射到列”。随后会出现下拉列表，你可以选择要映射到该属性的列。



![](<images/本体管理平台（Ontology Manager） PRD-OWIObtcMnoWgVkxDmF4c6MEanFz.png>)

##### 2.4.3 编辑属性类型的元数据

你可以通过选中某个属性类型（property type）来编辑其元数据，如下图所示：

![](<images/本体管理平台（Ontology Manager） PRD-LVs8b5e5woCjwRx587Hc9KlMnLe.png>)

可编辑的属性元数据选项被分布在多个标签页（tabs）中，可进行如下配置：

1. **展示名称与描述（Display name and description）：**&#x70B9;击现有的展示名称或描述文本即可编辑。

2. **状态（Status）：**&#x9009;择当前状态以打开可选状态的下拉列表，可在`已弃用`（`deprecated`）、`实验性` （`experimental`）、`启用`（`active`） 之间选择。

3. **API 名称（API name）：**&#x70B9;击现有 API 名称以修改其值。（注意：`active` 状态的属性**不能**更改 API 名称）

4. **键（Keys）：**&#x6307;定某个属性是否为该对象类型的**标题键（title key）或主键（primary key）**。（注意：当对象类型处于 `active` 状态时，你**不能**更改其主键。）

5. **值格式化（Value formatting）：**&#x4E3A;属性值应用特定的格式化器（formatter），使其在应用中更易阅读。

6. **条件格式化（Conditional formatting）：**&#x4E3A;属性设置规则，决定其在应用中的渲染方式。

7. **属性基础类型（Property base type）：**&#x4ECE;下拉列表选择属性的**基础类型**。属性的基础类型决定了该属性在用户应用中可使用的操作集合。。

   > 例如：基础类型为 `timestamp` 的属性可以在 Object Explorer 的时间线（timeline）组件中展示。

   * 基础类型还包括以下高级类型：

     * **Vector（向量）**：用于在对象上存储向量，以支持语义搜索。

     * **`Geopoint`（地理点）**：用于定义表示地理点的属性。

     * **`Geoshape`（地理形状）**：用于定义表示地理形状的属性（如多边形、线）。

     * **Attachment（附件）**：用于在对象上存储文件，以供对象函数使用。

     * **Time series（时间序列）**：用于将属性定义为时间序列。

     * **Media reference（媒体引用）**：用于定义对媒体文件的引用。

     * **Cipher text（密文）**：用于存储经 Cipher 编码的字符串值。

     * **Struct（结构体）**：用于定义具有多个字段的、基于模式（schema）的属性。

   * 如果属性类型与其所映射的底层列类型不兼容，你会收到错误提示。

   * 如果你更改了对象属性类型（object property types），还必须同步更新与该对象属性交互的 Actions 所期望的类型。做法是：在 Ontology Manager 中打开对应的 Action，并编辑其期望类型（expected type）。

8. **类型类（Type classes，本期不做）：**&#x5E94;~~用类型类作为额外元数据，供应用解析与使用。~~

9. **可见性（Visibility）：**&#x9009;择当前可见性以打开可选项下拉列表。`可见`（`prominent`） 属性会引导应用优先向用户展示；`隐藏`（`hidden`） 属性不会出现在用户应用中。

完成属性元数据更改后，触发对受影响对象的**重新索引（re-index）**，以更新 Ontology。

##### 2.4.4 批量编辑多个属性

在属性编辑器中，你可以按住 **Cmd/Ctrl** 键并点击选择多个属性。选择多个属性后，将可进行以下批量编辑操作：

* 更改基础类型

* 添加/移除类型类

* 更改可见性

* 添加/移除值格式化（value formatting）

![](<images/本体管理平台（Ontology Manager） PRD-Ed3abNt4bovCy9xePy8cMLRZnug.png>)

也可以在属性编辑器之外批量编辑其中一些字段：在对象类型视图的侧边栏选择 **Properties** 页面，勾选你想编辑的属性旁的复选框，此时表格顶部会出现一行新的批量编辑选项。



#### 2.5 添加值格式化

**值格式化（Value formatting）** 指的是为属性的值应用特定的格式化器，将原始值转换为更易读的展示形式。在下图中，左侧（**Before**）展示的是未做任何格式化的 `weight` 和 `value` 列；右侧（**After**）中，`weight` 列被应用了单位（“kg”），而 `value` 列则以更紧凑的形式并带有货币符号显示（如“$100K”）。这两者都是数值格式化（numeric formatting）的示例。

![](<images/本体管理平台（Ontology Manager） PRD-image-13.png>)

Ontology 还支持**日期和时间格式化**，以及user ID 格式化、resource RID 格式化和artifact GID  格式化。

##### 2.5.1 添加值格式化

在属性编辑器中：

1. 选择你希望添加值格式化的属性。

2. 在属性面板右侧，根据属性的基础类型（base type），你会看到对应的格式化类型选项（如值格式化、数值格式化、日期和时间格式化等）。开启相应的格式化开关。

   ![](<images/本体管理平台（Ontology Manager） PRD-image-14.png>)

3. 对于**数值格式化**和**日期与时间格式化**，还提供了额外的配置选项，详见下方：

   * 数值格式化选项

     ![](<images/本体管理平台（Ontology Manager） PRD-image-15.png>)

   | 名称                     | 说明                                               | 用法                                               |
   | ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
   | **Numeric formatting** | 开 / 关 开关                                         | 用于启用或移除数值格式化。                                    |
   | **Base type**          | 包含多种可用格式化类型（货币、单位、百分比、前缀 / 后缀、固定值），并附带示例和说明。     | 如果 `Capacity in Pounds` 有对应的单位，可在此下拉框中选择 “Unit”。 |
   | **Use grouping**       | 添加符合本地化规则的千分位分隔符。                                | 打开后可将 `123456` 显示为 `123,456`。                    |
   | **Notation**           | 支持紧凑（Compact）、科学计数法（Scientific）和工程计数法（Engineer）。 | 选择紧凑形式可将数值近似显示为 `123K`。                          |
   | **Preview result**     | 预览和测试数值格式化效果。                                    | 在输入框中输入一个与实际属性值相近的数值，以预览格式化后的展示效果。               |

   * 日期和时间格式化选项

     ![](<images/本体管理平台（Ontology Manager） PRD-image-16.png>)

   | 名称                        | 说明                 | 示例                               |
   | ------------------------- | ------------------ | -------------------------------- |
   | **Date**                  | 仅显示日期（不含时间）        | `Wed, Jul 22, 2020`              |
   | **Date and time (long)**  | 日期和时间（长格式）         | `Wed, July 22, 2020, 1:00:00 PM` |
   | **Date and time (short)** | 日期和时间（短格式）         | `Jul 22, 2020, 1:00 PM`          |
   | **ISO instant**           | 日期和时间（ISO 8601 格式） | `2020-07-22T13:00:00.000Z`       |
   | **Relative to now**       | 相对于当前时间的显示         | `8 minutes ago`                  |
   | **Time**                  | 仅显示时间（不含日期）        | `1:00 pm`                        |



4. 当选择不同的格式化选项时，界面会实时显示**预览效果**，用于展示应用新格式后属性值将如何呈现。



## 3. 链接类型管理

#### 3.1 创建链接类型

创建并配置一个新链接类型的主要方式有 2 种：

1. 使用引导助&#x624B;**（推荐方式）**。

2. 手动创建。如果在完成创建流程前退出了助手，也可以通过手动方式完成：为新的链接类型指定其链接类型定义、键（keys）以及 API 名称（API names）。

##### 3.1.1 进入“创建链接类型”助手

创建新对象类型后，你可以将其 API 名称从系统分配的默认值修改为自定义值。

进入 Ontology Manager。要打开链接类型创建助手，可以使用以下任一方式：

* 在右上角从 New 下拉菜单选择 链接类型（Link type）。

  ![](<images/本体管理平台（Ontology Manager） PRD-image-17.png>)

* 在左侧边栏的 资源（Resources）下选择 链接类型（Link type），然后在 链接类型 页面右上角选择 创建新链接类型。

* 打开你想要建立链接的某个对象类型（object type），在其 概览（Overview） 页面的链接类型图（link type graph）中选择  创建新链接类型。

  ![](<images/本体管理平台（Ontology Manager） PRD-image-18.png>)

##### 3.1.2 配置新的链接类型

新的链接类型助手会引导你完成以下步骤：

1. 选择链接类型（relationship type）

   1. 在 **创建新链接类型** 对话框的第一步中，为该链接选择**链接类型**。

   2. 选择用于定义两个对象之间链接的链接类型：

      * **Object type foreign keys（对象类型外键）**：支持“一对一（one-to-one）”与“多对一（many-to-one）”基数关系（cardinality）的链接类型。该选项允许你选择用于表示外键与对应主键的属性。关于如何用外键定义链接资源，见下方“外键关系类型”。

      * **Join table dataset（连接表数据集）**：用于“多对多（many-to-many）”基数关系的链接类型。该选项允许你使用一个连接表数据集（join table dataset）作为链接的底层数据源。关于如何用数据集定义链接资源，见下方“连接表数据集链接类型”。

      * **Backing object type（支撑对象类型）**：对象支撑的链接类型（object-backed link types）是在多对一链接类型之上扩展而来，提供将对象类型作为链接存储方案的一等支持（first class support）。关于如何定义由对象支撑的链接资源，见下方“支撑对象链接类型”。更多信息可参考“对象支撑链接（object-backed links）”章节。

      下面示例中，假设存在两个通过某种基数关系关联的对象类型：`Aircraft` 与 `Flight`。基数关系包括：

      * *一对一（one-to-one）*：表示一个 `Aircraft` 应链接到单个 `Flight`。该基数关系用于表达“期望的关系”，但**不会被强制约束（not enforced）**。

      * *一对多（one-to-many）*：表示一个 `Aircraft` 可以链接到多个 `Flights`。

      * *多对一（many-to-one）*：表示多个 `Aircraft` 可以链接到一个 `Flight`。

      * *多对多（many-to-many）*：表示一个 `Aircraft` 可以链接到多个 `Flights`，同时一个 `Flight` 也可以链接到多个 `Aircraft`。

   3. 选择 下一步（Next） 进入下一步。

      ![](<images/本体管理平台（Ontology Manager） PRD-image-19.png>)

2. 定义链接资源（link resources）

   1. 外键关系类型（Foreign key relationship type）

      在“一对一”或“多对一”的链接类型中，你需要为链接定义外键属性与主键属性：某一对象类型的外键（foreign key）属性必须引用另一对象类型的主键（primary key）属性。

      例如，在 `Aircraft` 对象类型中，`Tail Number` 属性是主键；在 `Flight` 对象类型中，`Flight Tail Number` 属性是外键。当某个 `Aircraft` 的 `Tail Number` 与某个 `Flight` 的 `Flight Tail Number` 匹配时，就会在 `Aircraft` 与 `Flight` 之间创建链接。

      操作步骤：

      1. 在 **Link resources** 步骤中，选择该链接涉及的对象类型。

      2. 在右侧下拉框选择“主键对象类型”（示例中为 `Aircraft`）。

      3. 在左侧下拉框选择“外键对象类型”（示例中为 `Flight`）。当满足以下条件时，创建对话框会检测并自动选择外键：

         * 外键与被链接对象类型的主键匹配；

         * 两个对象的属性类型一致。

      4. 选择用于构成链接的属性：

         * 对于外键对象类型，选择作为源对象类型外键的属性（示例：`Flight Tail Number`）；

         * 由于每个对象类型只有一个主键，主键属性会自动选中（示例：`Tail Number`）。

      5. 选择 **Next** 继续。

      ![](<images/本体管理平台（Ontology Manager） PRD-image-20.png>)

   ***

   * 连接表数据集关系类型（Join table dataset relationship type）

     在“多对多”基数关系下，你需要选择一个底层数据源（datasource），其中包含第一个对象类型主键（示例中 `Aircraft`）与第二个对象类型（示例中 `Flight`）之间**所有链接组合**。

     “多对多”基数关系需要底层数据源支撑，这是为了使用户能够对该链接类型进行**编辑或回写（edit or write back）**。

     操作步骤：

     1. 在 **Link resources** 步骤中，选择该链接涉及的对象类型。

     2. 在左侧下拉框选择第一个对象类型（示例：`Flight`）。

     3. 在右侧下拉框选择第二个对象类型（示例：`Aircraft`）。

     4. 选择连接表数据集（join table dataset）。选择一个包含列（columns）且这些列能够匹配所选两个对象类型主键的数据集。**一个列只能映射到一个主键**。

        * 现在可以为新的链接类型**自动生成连接表**：选择 **Generate join table** 会根据你选择的两个对象类型主键生成具有正确 schema 的数据集。这样在你需要“用户可编辑支撑的数据”或希望稍后再补充生产数据时，可以更快开始。

     5. 选择链接类型底层数据源中的列，并将其分别映射到两侧对象类型的主键。

     6. 选择 **Next** 继续。

     ![](<images/本体管理平台（Ontology Manager） PRD-image-21.png>)

   ***



   * 支撑对象关系类型（Backing object relationship type）

     在创建对象支撑链接（object-backed link）之前，请确保已创建所需的**前置条件（prerequisites）**&#x5BF9;象与链接。

     操作步骤：

     1. 选择前置条件中创建的对象类型，以表达你希望的链接类型：左右两侧对象表示将被链接的两个实体；中间对象作为**中介对象（intermediary）**，用于承载两者连接的附加元数据，并作为链接的支撑（backing）。

     2. 如果左/右对象与中介对象之间存在多条链接，请使用下拉菜单选择你希望使用的那条链接边（link edge）。

     ![](<images/本体管理平台（Ontology Manager） PRD-image-22.png>)

3. 定义链接类型名称（link type names）

   1. 在 **Link type names** 步骤中，为新链接类型提供\*\*显示名称（display name）\*\*与 **API 名称（API name）**。

   2. 为链接类型的每一侧输入显示名称。链接类型的一侧代表“指向该对象类型的链接（link *to* that object type）”。
      &#x20;在示例中，`Aircraft` 一侧的显示名称描述的是从 `Flight` *到* `Aircraft` 的链接。你可以将其命名为 `Assigned Aircraft`，因为一个 `Flight` 对应一个 `Assigned Aircraft`。

   3. API 名称会基于显示名称自动生成，但你可以按需修改。

      * API 名称用于在代码中以编程方式引用链接类型。链接类型某一侧的 API 名称可用于返回该侧对象类型的对象集合。
        &#x20;例如，如果 `Aircraft` 一侧的 API 名称为 `assignedAircraft`，则调用 `Flight.assignedAircraft.get()` 会返回与这些 `Flight` 对象相链接的 `Aircraft` 对象。

      * 链接类型的 API 名称**必须**满足以下要求：

        * 以小写字母开头，只包含字母数字字符（alphanumeric）；

        * 在与同一对象类型关联的所有链接类型中保持唯一；

        * 长度为 1 到 100 个字符；

        * 经过 NFKC 规范化（NFKC normalized）；

        * 不能是保留关键字（reserved keyword）。

   4. 选择 **Next** 继续。

   ![](<images/本体管理平台（Ontology Manager） PRD-image-23.png>)

***

* 选择保存位置（save location）

  在最后一步，选择一个项目（project）作为该链接类型的保存位置，然后选择 **Submit**。完成后，新的链接类型将被创建，但**尚未保存**到本体中。

  ![](<images/本体管理平台（Ontology Manager） PRD-image-33.png>)

* 保存更改到本体（save change to ontology）

  回到 Ontology Manager 后，在右上角选择 **Save**，将更改提交到你的本体（Ontology）。



##### 3.1.3 对象支撑链接（Object-backed links）

对象支撑链接类型（object-backed link types）是在常见的多对一（many-to-one）链接之上做的一种增强：
&#x20;它不再把“链接”只当作一条简单的关系边，而是让一个对象类型来承载这条关系，把“关系本身”变成一个可存储、可查询、可配置权限的对象。

这么做带来两类核心能力：

1. **可以在链接上记录更多信息（元数据）**
   &#x20;传统的外键链接或数据集（join table）支撑链接，链接通常只有“连上/没连上”的事实；
   &#x20;而对象支撑链接允许你把与这条关系相关的字段直接放在“链接对象”上，例如备注、角色、时间、状态等。

2. **支持受限视图（restricted views）等更细粒度的控制**
   &#x20;因为链接由“对象”承载，所以你可以像管理普通对象那样，对它做权限、视图限制等配置，从而实现“同一条关系在不同人眼里看到的信息不同”。

***

**例子：用 `Flight Manifest` 把航班与飞机“连起来”**

假设我们已经有两个对象类型：

* `Aircraft`（飞机）

* `Flight`（航班）

如果只是建立普通链接，我们可能会做一个 `Flight → Assigned Aircraft` 的链接类型，让每个航班连到一架飞机。
&#x20;但当你希望“这条关系本身”还要附带信息时（比如机组人员是谁、交接状态是什么、登机单信息等），普通链接就不够用了。

这时可以引入第三个对象类型作为**承载对象**（也就是 *backing object*），例如：

* `Flight Manifest`（航班清单/任务单）

在对象支撑链接的结构里：

* 左边：`Aircraft`

* 右边：`Flight`

* 中间：`Flight Manifest`（负责“承载”这条链接）

`Flight Manifest` 既把 `Aircraft` 和 `Flight` 关联起来，又可以额外拥有自己的属性，比如：

* `Pilot`（机长）

* `First Mate`（副驾驶）

* 以及其他你希望附加在“航班—飞机这个组合关系”上的字段

换句话说：
**外键/数据集支撑链接 = 关系是一条边**
**对象支撑链接 = 关系是一条“有实体、有字段、有权限”的对象**

![](<images/本体管理平台（Ontology Manager） PRD-image-34.png>)

***

**创建对象支撑链接类型的前置条件（Prerequisites）**

在你创建对象支撑链接类型之前，必须先完成：

1. **先创建链接两侧的对象类型**
   &#x20;例如：`Aircraft`、`Flight`

2. **创建用于承载关系的支撑对象类型（backing object type）**
   &#x20;例如：`Flight Manifest`

3. **分别创建两侧到支撑对象的多对一链接类型**
   &#x20;也就是先把两条“普通链接”建出来，让 `Flight Manifest` 能够分别指向两侧：

   * `Aircraft → Flight Manifest`（多对一）

   * `Flight → Flight Manifest`（多对一）

完成以上三步之后，你才有条件在此基础上创建“对象支撑链接类型”（把这套结构提升成一个一等的 link type 供应用使用）。

***

**把已有链接改造成对象支撑链接（Convert existing links）**

已经存在的链接类型也可以升级为对象支撑链接类型，但前提同样是：上面提到的对象与两条多对一链接都要先准备好。

转换步骤的直觉理解是：

* 在 Ontology Manager 中打开该链接。

* 在 **Configuration** 区域，更新 join method 并选择 **Object type**。

* 在 **Update link type to object-backed link type** 对话框中选择支撑对象类型（例如 `Flight Manifest`）。

* 在同一对话框中，从“到支撑对象的链接边（link edges）”里选择对应的链接类型。

* 提交更新（Update to object-backed）

***

#### 3.2 编辑链接类型

**warning：**&#x7F16;辑链接类型可能带来**破坏应用的后果**，从而中断用户工作流。在继续进行任何链接类型编辑之前，请先阅读[潜在破坏性变更](https://www.palantir.com/docs/foundry/object-link-types/edit-link-types/#potential-breaking-changes)章节。

##### 3.2.1 导航到既有链接类型

你可以随时切换正在编辑的链接类型：在主页侧边栏中选择链接类型页面，然后从列表中选择不同的链接类型。你也可以在应用顶部的搜索栏中搜索链接类型。

##### 3.2.2 删除链接类型

你可以通过点击链接类型视图侧边栏右上角的“三点”图标，然后在下拉菜单中选择 **Delete（删除）**。随后会弹出对话框，确认你要将该链接类型加入“待删除（staged for deletion）”状态。

* 注意：链接类型的删除只有在你保存更改后才会生效，并且会破坏任何引用该链接类型的视图或应用。

* 注意：处于 `active` 状态的链接类型无法删除。

![](<images/本体管理平台（Ontology Manager） PRD-image-32.png>)

##### 3.2.3 更改底层数据源

你可以按以下步骤更改后备数据源：

1. 进入链接类型视图的 **Datasources（数据源）** 页面。

2. 点击现有数据源旁的 **Select（选择）** 图标。随后你可以浏览并选择可用的数据源。

![](<images/本体管理平台（Ontology Manager） PRD-image-24.png>)

##### 3.2.4 编辑链接类型元数据

![](<images/本体管理平台（Ontology Manager） PRD-image-25.png>)

1. **Status（状态）**：选择链接类型面板顶部的当前状态，打开可用状态下拉列表。在 `deprecated`、`experimental`、`active` 三种状态中选择。

2. **Key（键）**：通过下拉框更改外键，或在多对多链接类型中更改列映射。

   * 注意：对于多对多（many-to-many）基数的链接类型，后备数据源中的列必须映射到对象类型的主键（primary key）。如果对象类型主键属性的类型与链接类型后备数据源中被映射列的类型不一致，系统会报错并阻止保存。

   * 注意：对于其他任意基数的链接类型，应用要求其中一个对象类型的键必须映射到该对象类型的主键，以确保基数中的 “one（单端）” 一侧是唯一的。

3. **API name（API 名称）**：点击现有 API 名称即可修改其值。

   * 注意：处于 `active` 状态的链接类型不能更改 API 名称。

   * 更多信息请参阅[状态（statuses）](https://www.palantir.com/docs/foundry/object-link-types/metadata-statuses/)。

   * 更多信息请参阅[有效的 API 名称](https://www.palantir.com/docs/foundry/object-link-types/create-object-type/#configure-api-names)。

4. **Visibility（可见性）**：在链接可见性列表中查看/设置可见性。`prominent` 的链接类型会提示应用优先向用户展示该链接类型；`hidden` 的链接类型不会出现在用户应用中。

5. **Type classes（类型类）**：将类型类作为附加元数据应用，供应用进行解释与使用。

## 4. 对象类型分组管理

**对象类型组**是一种用于分类的**原语**（classification primitive），可帮助用户更好地在本体（Ontology）中进行搜索与探索。组通过本体管理平台（Ontology Manager）创建和管理，通常由本体的所有者和编辑者负责维护。

#### 4.1 分组配置

分组可通过组菜单（groups menu）进行创建与管理，该菜单可在本体管理平台侧边栏中访问。

![](<images/本体管理平台（Ontology Manager） PRD-image-26.png>)

也可以在对象类型的概览页中选择 编辑分组，直接把组添加到对象类型上。

![](<images/本体管理平台（Ontology Manager） PRD-image-27.png>)

#### 4.2 组搜索与发现（Group search and discovery）

组可以在本体管理平台的 **Search** 搜索栏及其搜索对话框中被搜索到。本体管理平台中的对象类型表格支持按组进行展示与筛选。组也会显示在 Object Explorer 首页中。

![](<images/本体管理平台（Ontology Manager） PRD-image-28.png>)

#### 4.3 组权限（Group permissions）

要查看对象类型组，用户必须对该对象类型组所在的项目（project）具备 **viewer** 权限。



## 5. 本体搜索

在应用顶部栏（Header）的中间位置是 **Search（搜索）** 栏。你可以点击 **Search** 栏，或按住 `Cmd/Ctrl + K` 打开 **Search** 栏对话框。

![](<images/本体管理平台（Ontology Manager） PRD-image-29.png>)

在首页使用 **Search** 栏进行搜索，会将首页内容更新为与搜索条件匹配的资源列表。你可以搜索任何你感兴趣的对象类型（object type）、属性（property）、链接类型（link type）、操作类型（action type）、共享属性（shared properties）、接口（interfaces）或函数（functions）。



搜索结果会高亮显示你的搜索词匹配到了哪个字段。你可以使用键盘的上/下方向键在搜索结果中移动，并查看当前选中结果的预览。



你可以选择 **Open（打开）**，或按 Enter 键打开选中的结果。

![](<images/本体管理平台（Ontology Manager） PRD-image-30.png>)

#### 5.1 筛选器过滤

可以从左侧边栏选择 **Object types（对象类型）**、**Link types（链接类型）**、**Action Types（操作类型）**、**Shared Properties（共享属性）**、**Interfaces（接口）** 和 **Functions（函数）** 页面。这些页面支持按资源的可见性、开发状态以及索引问题来筛选对象类型与链接类型。

![](<images/本体管理平台（Ontology Manager） PRD-image-31.png>)

#### 5.2 从已选项返回导航

当打开某个对象类型、链接类型或动作类型后，可以在视图侧边栏左上角选择 **Back home（返回首页）**。

![](<images/本体管理平台（Ontology Manager） PRD-image-35.png>)

将鼠标悬停在 **Back home** 按钮上，还会显示快捷链接：包括最近编辑过的对象类型、链接类型、操作类型，以及所有与你当前正在查看的资源相关联的资源。

![](<images/本体管理平台（Ontology Manager） PRD-image-36.png>)



## 6. 变更管理（Change management）

### 6.1 **保存对本体的更改**

#### 6.1.1 保存更改

在本体管理平台（Ontology Manager）中进行的任何更改，都会先以本地进行中（work-in-progress）的状态保存。要让这些本体更改对其他人可见，并在面向用户的应用中生效，必须保存更改。保存更改的步骤如下：

1. 在应用右上角的应用标题栏中选择 **Save（保存）**。

![](<images/本体管理平台（Ontology Manager） PRD-MvAJbuZOmoe5oaxfoYfcAcNKnoh.png>)

2. 打开 **Review edits（审阅编辑）** 对话框，查看做出的所有更改。

3. 最后，选择 **Save（保存）** 以更新本体。

![](<images/本体管理平台（Ontology Manager） PRD-K9v5bAoCkoRkA4xqns7cpGiknFD.png>)

#### 6.1.2 处理错误与警告

如果 **Save（保存）** 按钮变为灰色不可用，你可能遇到了阻止保存的错误。你可以通过以下方式解决：

* 滚动查看你的更改，在对应位置直接查看内联错误信息，或

* 在 **Review edits（审阅编辑）** 对话框顶部选择 **Errors（错误）** 选项卡，查看阻止你保存的错误列表。

**Review edits（审阅编辑）** 对话框也会以内联方式以及在 **Warnings（警告）** 选项卡中展示警告信息（这些是建议你处理的更改）。**错误**必须处理后才能保存，而**警告**不会阻止你保存。

![](<images/本体管理平台（Ontology Manager） PRD-T1Dsb6iwwohktXxH8HDcqKWhnse.png>)

如果你收到了错误提示，可以使用 **Open** 快捷方式，快速导航到在保存前需要编辑的资源。

![](<images/本体管理平台（Ontology Manager） PRD-CLQRbHrN6ooiQaxWLx2c3qyxncb.png>)

注意：对 **Functions（函数）** 的更改只能在 **Functions 仓库（Functions repository）** 中进行，而不能在本体管理平台中直接修改。你可以在本体管理平台的 **Functions 实体视图（Functions Entity view）** 中导航到 Functions 仓库。

#### 6.1.3 处理更新与合并冲突

如果在你开始更改后，本体被其他用户保存过，**Save（保存）** 按钮也可能变为灰色不可用。此时你需要在 **Review edits（审阅编辑）** 对话框顶部选择 **Update（更新）**，将其他用户的更改与你当前的更改合并。

![](<images/本体管理平台（Ontology Manager） PRD-GVuWbPbTKolykhxM79TcZEOfnUc.png>)

也可能出现：其他用户的更改与你当前工作状态中的更改发生**合并冲突（merge conflicts）**。系统会提示你进行解决。你可以选择：

* 保留本体**最新版本**中的更改，或

* 用你当前工作状态（working state）中的更改覆盖它们。

![](<images/本体管理平台（Ontology Manager） PRD-KrszbHVq1oKd8qxzYVpcLhxbnXf.png>)

#### 6.1.4 丢弃更改

你编辑过的本体中每个**资源（resource）**，都会在 **Review edits（审阅编辑）** 对话框中有各自的条目。你可以将鼠标悬停在该条目上并选择垃圾桶图标，以丢弃对该资源所做的更改。

![](<images/本体管理平台（Ontology Manager） PRD-Rq7pbM8I0otrFSxd7Uucu52Jn8g.png>)

你也可以在任何时候丢弃所有尚未保存的本体更改：点击应用右上角标题栏中的 **Discard（丢弃）** 按钮，或在 **Review edits（审阅编辑）** 对话框底部选择 **Discard（丢弃）**。

![](<images/本体管理平台（Ontology Manager） PRD-YzAhbvhzBorvnBxdYE1cuMIgney.png>)

#### 6.1.5 响应警告消息

当你在 **Review edits（审阅编辑）** 对话框中审阅更改时，可能会看到一条警告消息，要求你在保存前确认该警告。

对对象类型及其属性的编辑，可能会对依赖这些对象类型的应用造成**破坏性影响（application-breaking impact）**。此外，如果某个对象类型启用了**回写（writeback）**，编辑该对象类型时应更加谨慎，以确保不会移除该类型对象的编辑历史。

当你阅读完警告消息中详细说明的影响并理解其含义后，可以在输入框中键入你所编辑实体（entity）的名称，以继续保存。

![](<images/本体管理平台（Ontology Manager） PRD-ZJ1mbr0BaoSFmKxSnQycZA9Jnnb.png>)

#### 6.1.6 保存失败时的故障排查

如果支撑本体的后端服务在保存时遇到问题，你会收到一条错误 “toast”（弹出提示），如下图所示。在解释无法保存原因的文本末尾，会打印错误消息名称。

![](<images/本体管理平台（Ontology Manager） PRD-JCIWbORIcorTLFxqarDckLbsneh.png>)

在本体文档中，针对对本体进行不同更改时最常见的错误，都有相应的说明。如果你看到某个错误消息名称，请在文档中搜索该名称，查看是否已记录该错误及其修复/处置方法（remediation）。

### 6.2 查看并恢复更改

1. 全局查看你对 Ontology 所做的**未保存更改**：在主页侧边栏中，选择“未保存更改”（Unsaved changes），即可查看你所做的所有未保存更改列表。

   ![](<images/本体管理平台（Ontology Manager） PRD-CqT0bae3koHHzexk8hrceGi0nhh.png>)

2. 全局查看对 Ontology 的**已保存更改**：在主页侧边栏中选择 历史（History） 选项卡，即可查看所有已保存的 Ontology 更改列表，并包含更改发生时间及应用更改的用户等详细信息。默认情况下，更改列表是折叠的。你可以在任意一条更改记录上选择向下箭头 icon 以查看详情。。

   ![](<images/本体管理平台（Ontology Manager） PRD-image-38.png>)

3. 查看单个 Ontology 资源的更改：再某个 Ontology 资源页面中选择 **History** 选项卡。系统会显示该资源的编辑列表，包括以下信息：

   * 你对该资源所做的未保存更改。

   * 该资源所有已保存的更改，并包含更改发生时间及应用更改的用户等详细信息。

     ![](<images/本体管理平台（Ontology Manager） PRD-image-37.png>)

   * 在 Ontology 资源视图的左下角，页脚会显示该资源的上次编辑时间以及编辑者。

4. 恢复单个对象类型的更改

   按以下步骤将对象类型恢复到较早版本：

   1. 选择恢复按钮 （逆时针箭头icon）

   2. 选择 “确认”（confirm）。

   **warning：**&#x5C06;对象类型恢复到先前版本后，你所选条目之后发生的所有更改都会被撤销。这些撤销操作会被添加到你的工作状态中；你需要将更改保存到 Ontology 后，恢复操作才会生效。



## 7. 导出、编辑并导入本体

本体的 schema 定义存储在一个 JSON 文件 ↗ 中。本体 JSON 文件可以导出，并在重新导入之前使用代码编辑器或文本编辑器进行编辑。此导入/导出功能为高级用户支持两类工作流：

* 如果你更偏好用代码进行本体编辑，你可以通过导出本体 JSON 文件，绕过 Ontology Manager 界面；在代码编辑器或文本编辑器中直接修改该 JSON 文件，然后将修改后的本体 JSON 文件导入回平台。

* 如果你希望将一个本体的工作状态（working state）复制到另一个本体，你可以将该本体的当前状态导出为 JSON 文件，然后将复制得到的 JSON 导入回平台（并可在代码编辑器中对 JSON 做任何需要的修改）。

![](<images/本体管理平台（Ontology Manager） PRD-image-39.png>)

### 7.1 导出（Export）

在应用首页进入 **Advanced**（高级）设置页面，然后选择 **Export** 来导出本体的工作状态。

你在工作状态中所做的任何更改都会包含在导出内容中。

### 7.2 导入（Import）

在应用首页进入 **Advanced**（高级）设置页面，然后选择 **Import** 来导入先前导出的本体工作状态。系统会提示你从本地磁盘选择一个本体文件。

接下来选择 **Import**，应用将根据该 JSON 文件**重建整个工作状态**。你会在应用页眉（header）中看到文件中带来的更改数量，这些更改需要在应用内保存（Save）。

> 注意：如果导出的本体工作状态中，在属性上配置了**条件格式（conditional formatting）规则**，则该工作状态**不能**被导入到除其导出来源以外的其他本体中。

### 7.3 故障排查（Troubleshooting）

错误：`OntologyMetadata:UnreferencedRuleSets`

如果你收到错误 `OntologyMetadata:UnreferencedRuleSets`，说明你正在导入的本体工作状态包含一些**条件格式规则**，而这些规则在目标本体中**未定义**，并且**无法迁移**。你需要在导入前先从该本体工作状态中删除这些条件格式规则。

***

## 8. 数据连接（Data Connection）

数据源连接管理和数据导入功能（包括 MySQL 连接器、Excel/CSV 文件上传）已剥离为独立模块。

详见《[数据连接（Data Connection）PRD](数据连接（Data Connection）PRD.md)》。

Ontology Manager 中的对象类型创建/编辑流程通过选择平台内已有 Dataset 来关联底层数据源，不再内嵌数据导入向导。

