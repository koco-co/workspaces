---
suite_name: "【内置规则丰富】有效性，json中key对应的value值格式校验(#15694)"
description: "有效性校验支持对json类型字段做key对应的value值格式校验"
prd_id: 15694
prd_version: "v6.3.10"
root_name: "数据资产v6.3.10迭代用例(#23)"
product: ""
tags:
  - "内置规则丰富"
  - "有效性校验"
  - "json格式校验"
  - "value值格式"
  - "数据质量"
  - "规则集管理"
  - "规则任务管理"
  - "规则配置"
  - "质量报告"
  - "校验key"
  - "数据源兼容性"
create_at: "2026-04-06"
status: "草稿"
case_count: 30
origin: "xmind"
---

## 数据质量

### 规则集管理

#### 规则配置-选项UI

##### 【P1】验证规则配置页「统计规则」下拉框中「格式-json格式校验」选项位置在「格式校验-自定义正则」上方

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「person-name」，中文名称「人员姓名」，value 格式正则：^[\u4e00-\u9fa5]+$
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表（SparkThrift2.x 不支持 JSON 类型，使用 STRING 存放 JSON 字符串）：
   DROP TABLE IF EXISTS pw_test.json_format_test;
   CREATE TABLE pw_test.json_format_test (
     id INT,
     info STRING,
     name STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_format_test
   SELECT 1, '{"person-name":"张三"}', 'row1'
   UNION ALL
   SELECT 2, '{"person-name":"李四"}', 'row2';
4) 已在资产平台引入该表
5) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_value_fmt_ui"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"value格式校验UI测试包"，点击【下一步】进入 Step 2 监控规则；该规则包内当前不预先添加任何已保存规则，仅用于本用例打开下拉查看选项位置
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_value_fmt_ui"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成，"value格式校验UI测试包"区块正常展示 |
| 3    | 在"value格式校验UI测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，展开「统计规则」下拉框并向下滚动查看完整选项列表 | 1) 「统计规则」下拉框中出现「格式-json格式校验」选项<br>2) 「格式-json格式校验」选项位于「格式校验-自定义正则」选项的上方（与 PRD「新增"格式-json格式校验"选项，位置放在自定义正则的上方」一致） |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证「格式-json格式校验」当前不展示独立悬浮提示图标

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「person-name」，中文名称「人员姓名」，value 格式正则：^[\u4e00-\u9fa5]+$
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表：
   DROP TABLE IF EXISTS pw_test.json_format_test;
   CREATE TABLE pw_test.json_format_test (
     id INT,
     info STRING,
     name STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_format_test
   SELECT 1, '{"person-name":"张三"}', 'row1'
   UNION ALL
   SELECT 2, '{"person-name":"李四"}', 'row2';
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_value_fmt_tip"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"提示测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_value_fmt_tip"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"提示测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，将「统计规则」选择为「格式-json格式校验」，观察该统计规则所在行 | 1) 该统计规则所在行不展示独立的 tooltip / help 图标<br>2) 不会额外弹出仅归属于「格式-json格式校验」统计规则的提示浮层 |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 规则配置-字段类型限制

##### 【P1】验证「格式-json格式校验」在 INT 与 STRING 字段下均可见可选（前端不按字段类型做隐藏）

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「person-name」，中文名称「人员姓名」，value 格式正则：^[\u4e00-\u9fa5]+$
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建包含多种字段类型的测试表（SparkThrift2.x 不支持 JSON 类型，使用 STRING 存放 JSON 字符串）：
   DROP TABLE IF EXISTS pw_test.multi_type_test;
   CREATE TABLE pw_test.multi_type_test (
     id INT,
     name STRING,
     age INT,
     salary DECIMAL(10,2),
     info STRING,
     created_at DATE
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.multi_type_test
   SELECT 1, 'alice', 25, CAST(100.50 AS DECIMAL(10,2)), '{"person-name":"张三"}', DATE '2026-04-01'
   UNION ALL
   SELECT 2, 'bob',   30, CAST(200.75 AS DECIMAL(10,2)), '{"person-name":"李四"}', DATE '2026-04-02';
4) 已在资产平台引入该表，且元数据字段类型识别正确
5) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_field_type_test"，关联 SparkThrift2.x 数据源 pw_test 库 multi_type_test 表，规则包名称"字段类型测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_field_type_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成，"字段类型测试包"区块正常展示，包内暂无规则行 |
| 3    | 在"字段类型测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「id（int）」，展开「统计规则」下拉框查看选项 | 1) 「统计规则」下拉框正常展开<br>2) 下拉选项中可见「格式-json格式校验」选项，且未置灰<br>3) 与字段类型无关：源码 `STATISTICS_FUNC.FORMAT_JSON_VERIFICATION` 未出现在 `hiddenFunctionIds` 列表中，前端不按字段类型隐藏该选项 |
| 4    | 将「字段」切换为「info（string）」（SparkThrift2.x 中 JSON 字段以 STRING 形式存储），再次展开「统计规则」下拉框 | 「统计规则」下拉框中仍可见「格式-json格式校验」选项，可被点击选中 |
| 5    | 将「字段」切换为「name（string）」，再次展开「统计规则」下拉框 | 「统计规则」下拉框中仍可见「格式-json格式校验」选项，可被点击选中（说明 STRING 类字段一律可选） |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`、`name` 改为 `VARCHAR(255)`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 规则配置-校验key选择

##### 【P1】验证校验key列表中仅配置了value格式的key可被选中，未配置value格式的key不可选中

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护以下层级数据：
   - 父节点「person」
   - 父节点「person」下子节点「name」，回显为 key 路径「person-name」，已配置 value 格式正则 `^.+$`
   - 父节点「person」下子节点「age」，回显为 key 路径「person-age」，已配置 value 格式正则 `^\d{1,3}$`
   - 父节点「person」下子节点「email」，回显为 key 路径「person-email」，**未配置** value 格式
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表：
   DROP TABLE IF EXISTS pw_test.json_format_test;
   CREATE TABLE pw_test.json_format_test (
     id INT,
     info STRING,
     name STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_format_test
   SELECT 1, '{"person":{"name":"张三","age":"25","email":"a@b.com"}}', 'row1'
   UNION ALL
   SELECT 2, '{"person":{"name":"李四","age":"30","email":"c@d.com"}}', 'row2';
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_key_select_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"key选择测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_key_select_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"key选择测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，将「统计规则」选择为「格式-json格式校验」，展开「校验key」TreeSelect 下拉框，查看列表中各 key 的可选状态 | 「校验key」下拉框列表中：<br>1) 「person-name」（已配置 value 格式）显示为可选状态，可点击勾选<br>2) 「person-age」（已配置 value 格式）显示为可选状态，可点击勾选<br>3) 「person-email」（未配置 value 格式）显示为不可选状态，节点 `disabled=true` 置灰禁用（源码 `disabledItem = (item) => !(item.value === JSON_TREE_ALL_KEY || item.jsonValue)`，未配置 value 格式即 `jsonValue` 为空时禁用） |
| 4    | 点击「person-email」尝试勾选 | 「person-email」无法被选中，复选框保持未勾选状态 |
| 5    | 依次勾选「person-name」与「person-age」 | 两个 key 均成功勾选，TreeSelect 输入框内回显对应 Tag「person-name」「person-age」 |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证校验key支持多选与全选操作

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护以下层级 key：
   - 「person-name」（已配置 value 格式正则 `^.+$`）
   - 「person-age」（已配置 value 格式正则 `^\d{1,3}$`）
   - 「person-email」（未配置 value 格式，仅用于区分可选/禁用态）
3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_format_test`（同上一用例的 DDL/INSERT 语句）
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_multi_select_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"多选全选测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_multi_select_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"多选全选测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，将「统计规则」选择为「格式-json格式校验」，展开「校验key」下拉框，分别勾选「person-name」「person-age」 | 两个 key 均成功勾选，复选框显示为选中状态 |
| 4    | 查看 TreeSelect 输入框的回显 Tag 内容 | 输入框 Tag 区域包含「person-name」与「person-age」两个已选 key |
| 5    | 点击下拉框中的「全部」节点（源码常量 `JSON_TREE_ALL_KEY_TEXT`） | 1) 选择「全部」后，源码 `handleChange` 仅保留 `[JSON_TREE_ALL_KEY]` 一项<br>2) 其余 key 节点变为 `disabled=true`（源码 `handleTreeDisabled` 中 `value?.includes(JSON_TREE_ALL_KEY) ? treeValue !== JSON_TREE_ALL_KEY : ...`） |
| 6    | 再次点击「全部」节点取消勾选 | 「全部」复选框恢复为未勾选；其余 key 节点恢复为可选；TreeSelect 输入框 Tag 区域清空 |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证校验key搜索功能正常

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护以下配置了 value 格式的 key：
   - 「order-amount」，中文名称「订单金额」，value 格式正则 `^\d+\.\d{2}$`
   - 「order-status」，中文名称「订单状态」，value 格式正则 `^(paid|pending)$`
   - 「user-name」，中文名称「用户姓名」，value 格式正则 `^.{1,20}$`
3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_format_test`
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_key_search_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"key搜索测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_key_search_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"key搜索测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，将「统计规则」选择为「格式-json格式校验」，展开「校验key」TreeSelect 下拉框，在搜索框中输入「order」，等待列表过滤完成 | 1) 下拉列表过滤展示，仅显示包含「order」的 key：「order-amount」与「order-status」<br>2) 「user-name」不在列表中显示 |
| 4    | 清空搜索框内容，等待列表恢复 | 下拉列表恢复展示全部 key：「order-amount」「order-status」「user-name」均重新显示 |

<!-- TODO[ambiguous]: TreeSelect 是否走前端本地过滤还是后端搜索接口（getRuleJsonTree(params={search})）。源码 `JsonFormatConfiguration` 在 useEffect 中只调一次 `getRuleJsonTree({})`，未传 search；而搜索 UX 似乎是前端本地过滤。原因：未在源码中找到 onSearch 回调；PRD 也未明确。建议拍板方向：默认假设前端本地过滤；如真走后端搜索，则前置条件需配 mock 接口。 -->

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证校验key超过200条时默认加载前200条展示

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中通过 Excel 批量导入维护 210 条已配置 value 格式的 key（命名为 test-key-001 至 test-key-210，中文名称「测试键001」至「测试键210」，每条均配置 value 格式正则 `^.+$`）。Excel 生成脚本：

   import openpyxl
   wb = openpyxl.Workbook()
   ws = wb.active
   ws.title = "一层"
   ws.append(["key", "中文名称", "value格式"])
   for i in range(1, 211):
       ws.append([f"test-key-{i:03d}", f"测试键{i:03d}", "^.+$"])
   wb.save("json_value_format_import_210.xlsx")

3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_format_test`
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_large_key_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"大数据量key测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_large_key_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"大数据量key测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，将「统计规则」选择为「格式-json格式校验」，展开「校验key」TreeSelect 下拉框，观察初始加载的 key 列表 | 1) 「校验key」下拉框初始展示前 200 条 key（test-key-001 至 test-key-200）<br>2) 第 201 条及以后的 key（test-key-201 至 test-key-210）不在初始列表中显示 |
| 4    | 在「校验key」搜索框中输入「test-key-205」 | 搜索结果中显示「test-key-205」节点，可正常勾选 |

<!-- TODO[ambiguous]: PRD line 196「考虑 key 数量几千个的情况」未指定 200 条上限。源码 `JsonFormatConfiguration` 调用的 `Api.getRuleJsonTree` 没有显式 limit 参数；200 条上限应来自后端默认分页。原因：前端源码无显式 limit；后端文档未读取。建议拍板方向：保留预期，运行时若实际不是 200 条，按真实值更新。 -->

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证校验key回显格式及勾选仅对当前层级生效

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护以下配置了 value 格式的 key（层级结构）：
   - 一级 key「person」下二级 key「name」，路径「person-name」，中文名称「人员姓名」，value 格式正则 `^[\u4e00-\u9fa5]+$`
   - 一级 key「person」下二级 key「age」，路径「person-age」，中文名称「人员年龄」，value 格式正则 `^\d{1,3}$`
   - 一级 key「address」下二级 key「city」，路径「address-city」，中文名称「地址城市」，value 格式正则 `^.{1,20}$`
3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_format_test`
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_layer_key_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"层级key测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_layer_key_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"层级key测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，将「统计规则」选择为「格式-json格式校验」，展开「校验key」下拉框，勾选「person-name」与「address-city」，点击规则行【保存】，再点击页面底部【保存】 | 1) 规则集保存成功<br>2) 列表回到规则集列表页，新增的"rule_set_layer_key_test"行的「规则数量」列展示 1<br>3) 重新编辑该规则集进入 Step 2，规则行「校验key」列回显内容包含「person-name」与「address-city」两个 Tag（按 source `tagRender` 中 `echoTitle` 拼接为「父-子」格式） |
| 4    | 编辑该规则，重新展开「校验key」下拉框，查看已勾选状态 | 1) 「person-name」复选框显示为勾选状态<br>2) 「address-city」复选框显示为勾选状态<br>3) 「person-age」复选框显示为未勾选状态（说明勾选仅对自身节点生效，未传染到同父节点的兄弟节点） |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 规则配置-校验key展示

##### 【P1】验证【数据质量报告】页面校验key列默认仅展示前两个，悬浮展示全部

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护以下配置了 value 格式的 key：
   - 「field-key1」，中文名称「字段键1」，value 格式正则 `^.+$`
   - 「field-key2」，中文名称「字段键2」，value 格式正则 `^.+$`
   - 「field-key3」，中文名称「字段键3」，value 格式正则 `^.+$`
   - 「field-key4」，中文名称「字段键4」，value 格式正则 `^.+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入数据：
   DROP TABLE IF EXISTS pw_test.json_hover_test;
   CREATE TABLE pw_test.json_hover_test (
     id INT,
     info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_hover_test
   SELECT 1, '{"field-key1":"v1","field-key2":"v2","field-key3":"v3","field-key4":"v4"}'
   UNION ALL
   SELECT 2, '{"field-key1":"x1","field-key2":"x2","field-key3":"x3","field-key4":"x4"}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_hover_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_hover_test 表，规则包名称"悬浮展示测试包"，在 Step 2 中配置「格式-json格式校验」规则，校验 key 选择 4 个：「field-key1」「field-key2」「field-key3」「field-key4」，已保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"悬浮展示测试任务"，仅通过【导入规则包】导入"悬浮展示测试包"，Step 3 调度配置后保存；任务列表点击【立即执行】，等待执行完成
6) 已通过【数据质量 → 数据质量报告】页面为该任务创建一次性报告，等待 ~15 分钟报告生成完成
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 数据质量报告】页面，等待报告列表加载完成 | 数据质量报告页面正常打开，报告列表加载完成 |
| 2    | 找到「悬浮展示测试任务」最新一次执行的报告，点击进入报告详情，找到「格式-json格式校验」规则行 | 报告详情页正常加载；「格式-json格式校验」规则行正常展示 |
| 3    | 观察「校验key」列在非悬浮状态下的显示内容 | 「校验key」字段区域默认仅展示前两个 key「field-key1」「field-key2」，后续 key 以省略符（…）截断 |
| 4    | 将鼠标悬浮在「校验key」字段区域，等待 tooltip 浮层出现 | 浮层展示全部 4 个 key 名：「field-key1」「field-key2」「field-key3」「field-key4」 |

<!-- TODO[ambiguous]: PRD line 249「鼠标悬浮展示全部的key名信息，默认仅展示前两个」未明确仅在数据质量报告页生效；用户口述补充「这是数据质量报告中才展示前两个，其它页面（规则集管理 / 规则任务管理）都是全量展示」。源码层面：`JsonFormatConfiguration`（编辑态 TreeSelect）使用 `maxTagCount="responsive"`，与"前两个"无关；`ValidContent`（展示态）只是把 ids 转成 key 字符串，未做"前两个"截断。原因：未在源码中找到固定 2 项截断的实现位置（可能是质量报告页特定的 css overflow 或自定义组件）。建议拍板方向：保留本用例验证质量报告页"前两个 + 悬浮全部"，并新增反向用例验证规则集管理是 responsive 全量展示。 -->

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证【规则集管理】Step 2 中校验key按 responsive 全量展示，不固定截断为前两个

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护「field-key1」「field-key2」「field-key3」「field-key4」（同上一用例）
3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_hover_test`（同上一用例）
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_responsive_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_hover_test 表，规则包名称"responsive 展示测试包"，在 Step 2 中配置「格式-json格式校验」规则，校验 key 选择 4 个：「field-key1」「field-key2」「field-key3」「field-key4」，已保存规则集
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_responsive_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面，找到"responsive 展示测试包"中已配置的「格式-json格式校验」规则行 | 该规则行的 TreeSelect 控件正常展示，输入框区域包含校验 key 的 Tag |
| 3    | 观察 TreeSelect 输入框中 Tag 的展示行为，调整浏览器窗口宽度（先放宽再收窄） | 1) 在窗口足够宽时，4 个 key 的 Tag 全部直接展示<br>2) 在窗口收窄到 Tag 区域宽度不足时，按 antd `maxTagCount="responsive"` 行为，超出部分折叠为「+N ...」标签，悬浮时展示完整列表（源码 `JsonFormatConfiguration` line 175 `maxTagCount="responsive"`）<br>3) **不会**固定地仅展示前两个（与数据质量报告页固定「前两个 + 悬浮全部」的展示行为不同） |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 规则配置-value格式预览

##### 【P1】验证点击【value格式预览】弹窗仅展示已勾选key的格式信息且支持分页

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护以下 15 条已配置 value 格式的 key：
   - 「check-key-01」，中文名称「校验键01」，value 格式正则 `^[A-Z]{2}\d{4}$`
   - 「check-key-02」，中文名称「校验键02」，value 格式正则 `^1[3-9]\d{9}$`
   - 「check-key-03」至「check-key-15」，中文名称「校验键03」至「校验键15」，各配置不同正则
3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_format_test`
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_preview_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"value预览测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_preview_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"value预览测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「info（string）」，将「统计规则」选择为「格式-json格式校验」，展开「校验key」下拉框，勾选「check-key-01」「check-key-02」「check-key-03」共 3 个 key | 3 个 key 成功勾选 |
| 4    | 点击【value格式预览】按钮，等待弹窗加载完成 | 弹窗正常打开：<br>1) 弹窗内列表仅展示已勾选的 3 个 key 对应的信息，未勾选的「check-key-04」至「check-key-15」不显示<br>2) 列表包含两列：「key」与「value格式」<br>3) 「check-key-01」对应 `^[A-Z]{2}\d{4}$`<br>4) 「check-key-02」对应 `^1[3-9]\d{9}$` |
| 5    | 关闭弹窗，取消勾选「check-key-03」，再次点击【value格式预览】按钮 | 弹窗内列表更新为仅展示「check-key-01」与「check-key-02」共 2 条记录，「check-key-03」不再显示 |
| 6    | 关闭弹窗，重新勾选「check-key-03」至「check-key-12」共 10 个 key（合计 12 个），点击【value格式预览】按钮，查看弹窗分页 | 1) 弹窗展示分页控件<br>2) 默认展示第 1 页数据<br>3) 可翻页查看剩余 key 的格式信息 |

<!-- TODO[ambiguous]: 弹窗内默认 pageSize 未在源码 `jsonPreviewModal` 显式可见；且 PRD 仅说明"分页展示"，未指定每页条数。建议拍板方向：以源码 antd Table 默认值（通常 10）为准；若发现实际默认 5 或 20，按运行结果更新。 -->

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 规则配置

##### 【P1】验证选择 INT 字段并配置「格式-json格式校验」可保存，但执行后在【校验结果查询】中显示校验失败

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「person-name」，中文名称「人员姓名」，value 格式正则 `^[\u4e00-\u9fa5]+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建包含 INT 类型字段的测试表：
   DROP TABLE IF EXISTS pw_test.int_type_test;
   CREATE TABLE pw_test.int_type_test (
     id INT,
     count_val INT,
     note STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.int_type_test
   SELECT 1, 100, 'note1'
   UNION ALL
   SELECT 2, 200, 'note2';
4) 已在资产平台引入该表，元数据中 count_val 字段类型识别为 int
5) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_int_type_test"，关联 SparkThrift2.x 数据源 pw_test 库 int_type_test 表，规则包名称"int类型限制测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_int_type_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"int类型限制测试包"行点击【新增规则】，选择【有效性校验】，将「规则类型」选择为「字段级」，将「字段」选择为「count_val（int）」，展开「统计规则」下拉框 | 1) 「统计规则」下拉框中**仍出现**「格式-json格式校验」选项（前端未按字段类型隐藏，源码 `STATISTICS_FUNC.FORMAT_JSON_VERIFICATION` 不在 `hiddenFunctionIds` 列表）<br>2) 选项**未置灰**，可被点击选中 |
| 4    | 选中「格式-json格式校验」，校验 key 勾选「person-name」，点击规则行【保存】，再点击页面底部【保存】 | 规则集保存成功（前端无表单层禁止 INT 字段保存） |
| 5    | 进入【数据质量 → 规则任务管理】，点击【新建监控规则】创建任务"INT 字段格式校验任务"，关联同一表，Step 2 通过【导入规则包】导入"int类型限制测试包"，Step 3 保存任务；返回任务列表点击【立即执行】 | 任务提交执行成功 |
| 6    | 进入【数据质量 → 校验结果查询】页面，找到「INT 字段格式校验任务」最新实例记录并打开实例详情 | 1) 实例状态显示「已完成」<br>2) 「格式-json格式校验」规则行的「质检结果」显示「校验不通过」（运行时尝试解析 INT 字段为 JSON 失败）<br>3) 「未通过原因」列展示后端返回的解析失败描述（具体文案以后端为准） |

<!-- TODO[ambiguous]: 用户口述「虽然可以选择，但只有在实际运行时才会在校验结果查询中知道是否错误」未指定具体的「未通过原因」文案。后端在 INT 字段上跑 JSON 解析时是返回「key对应value格式校验未通过」还是「字段类型不匹配」需要运行时确认。原因：未读取后端 `dt-center-assets` Java 实现的 JSON 校验函数。建议拍板方向：保留预期为「校验不通过」；具体「未通过原因」文案以首次执行真实结果为准并回填。 -->

> 使用 Doris3.x 数据源重复以上步骤，将 `count_val` 字段类型保持为 `INT`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致（INT 字段保存仍可通过，运行时校验不通过）。

##### 【P1】验证未选择校验key时保存规则提示「"格式-json格式校验"统计函数存在必填项未填写」

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「person-name」，中文名称「人员姓名」，value 格式正则 `^[\u4e00-\u9fa5]+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_format_test`
4) 已通过【数据质量 → 规则集管理】页面点击【新建规则集】创建规则集"rule_set_required_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"必填校验测试包"，点击【下一步】进入 Step 2 监控规则
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_required_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面 | Step 2 监控规则页面加载完成 |
| 3    | 在"必填校验测试包"行点击【新增规则】，选择【有效性校验】，按以下配置：<br>- *规则类型：字段级<br>- *字段：info（string）<br>- *统计规则：格式-json格式校验<br>- *校验key：**不勾选任何 key**<br>点击规则行【保存】，再点击页面底部【保存】 | 1) 保存失败<br>2) 页面顶部出现汇总错误提示「"格式-json格式校验"统计函数存在必填项未填写」（源码 i18n key `views.valid.ruleConfig.edit.components.rule.index.CG`，模板 `'"{val1}"统计函数存在必填项未填写'`，val1 为 functionName「格式-json格式校验」；注意花引号 `"` 来自源码常量，不是普通双引号 `"`）<br>3) 「校验key」TreeSelect 输入框内仍保留 placeholder 文案「请选择校验key」<br>4) 规则未被保存 |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 规则配置参数展示

##### 【P1】验证保存后规则配置参数展示区域各字段内容正确

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「person-name」，中文名称「人员姓名」，value 格式正则 `^[\u4e00-\u9fa5]+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库已存在测试表 `pw_test.json_format_test`
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_param_display_test"，关联 SparkThrift2.x 数据源 pw_test 库 json_format_test 表，规则包名称"参数展示测试包"，在 Step 2 中配置「格式-json格式校验」规则：<br>- 规则类型：字段级<br>- 字段：info（string）<br>- 统计规则：格式-json格式校验<br>- 校验 key：person-name<br>- 强弱规则：强规则<br>已保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成 | 规则集管理页面正常打开，列表加载完成 |
| 2    | 找到规则集"rule_set_param_display_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面，查看"参数展示测试包"中已配置的「格式-json格式校验」规则行的参数展示区域 | 规则配置参数展示区域各字段：<br>1) 规则类型 = 「字段级」<br>2) 字段 = 「info」<br>3) 统计规则 = 「格式-json格式校验」<br>4) 校验key = 「person-name」<br>5) 强弱规则 = 「强规则」 |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

### 规则任务管理

#### P0-主流程

##### 【P0】验证「格式-json格式校验」完整主流程：规则集配置 + 导入规则包 + 执行任务 + 校验结果查询查看通过实例

> 前置条件

```
1) 使用 admin 账号登录系统
2) 数据源中心已添加数据源「测试数据源_SparkThrift2」（SparkThrift2.x）并授权给资产平台
3) 已在「通用配置 → json格式校验管理」中维护以下层级 key：
   - 父节点「person」
   - 父节点「person」下子节点「name」，路径「person-name」，中文名称「人员姓名」，value 格式正则 `^[\u4e00-\u9fa5]+$`
   - 父节点「person」下子节点「age」，路径「person-age」，中文名称「人员年龄」，value 格式正则 `^\d{1,3}$`
   - 父节点「person」下子节点「email」，路径「person-email」，中文名称「人员邮箱」，**未配置** value 格式
4) 资产平台已引入该数据源 pw_test 数据库
5) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入数据（SparkThrift2.x 不支持 JSON 类型，使用 STRING 存放 JSON 字符串）：
   DROP TABLE IF EXISTS pw_test.json_format_test;
   CREATE TABLE pw_test.json_format_test (
     id INT,
     info STRING,
     name STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_format_test
   SELECT 1, '{"person":{"name":"张三","age":"25","email":"a@b.com"}}', 'row1'
   UNION ALL
   SELECT 2, '{"person":{"name":"李四","age":"30","email":"c@d.com"}}', 'row2';
6) 已在资产平台引入该表
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成，点击【新建规则集】 | 进入规则集 Step 1 基础信息页面 |
| 2    | 在 Step 1 基础信息中按顺序配置：<br>- *选择数据源：测试数据源_SparkThrift2<br>- *选择数据库：pw_test<br>- *选择数据表：json_format_test<br>- 规则集描述：（留空）<br>- *规则包名称：通过【新增】按钮添加「P0主流程测试包」<br>点击【下一步】 | Step 1 校验通过，进入 Step 2 监控规则页面 |
| 3    | 在 Step 2 中，在"P0主流程测试包"行点击【新增规则】，选择【有效性校验】，按以下配置：<br>- *规则类型：字段级<br>- *字段：info（string）<br>- *统计规则：格式-json格式校验<br>- *校验key：勾选「person-name」「person-age」<br>- 强弱规则：强规则<br>- 过滤条件：（留空）<br>- 规则描述：（留空）<br>点击规则行【保存】，再点击页面底部【保存】 | 1) 规则集保存成功<br>2) 列表新增 json_format_test 表对应的规则集记录<br>3) 规则包"P0主流程测试包"下显示已保存的「格式-json格式校验」规则<br>4) 校验 key 回显为「person-name」「person-age」 |
| 4    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成，点击【新建监控规则】，在 Step 1 基础信息中按顺序配置：<br>- *规则名称：json格式校验任务_P0<br>- *选择数据源：测试数据源_SparkThrift2<br>- *选择数据库：pw_test<br>- *选择数据表：json_format_test<br>点击【下一步】 | Step 1 校验通过，进入 Step 2 监控规则页面 |
| 5    | 在 Step 2 中点击【导入规则包】，勾选规则集"P0主流程测试包"并确认导入 | 规则包导入成功，Step 2 仅展示从规则集管理导入的「格式-json格式校验」相关规则 |
| 6    | 点击【下一步】进入 Step 3 调度属性，按默认配置后点击【保存】 | 规则任务创建成功，返回任务列表，可查询到任务"json格式校验任务_P0" |
| 7    | 在规则任务列表中找到"json格式校验任务_P0"，点击行**表名**展开任务详情抽屉，在抽屉中点击【立即执行】 | 1) 抽屉内出现执行中提示<br>2) 任务已提交执行（按 knowledge/data-quality.md §3 说明，立即执行入口在抽屉内，非列表行直接按钮） |
| 8    | 进入【数据质量 → 校验结果查询】页面，等待列表加载完成，点击"json格式校验任务_P0"最新实例记录的**表名**展开实例详情 | 1) 本次执行生成新的实例记录<br>2) 实例状态「已完成」，最新校验结果「校验通过」<br>3) 实例详情中「格式-json格式校验」规则行展示：规则类型=「有效性校验」、规则名称=「格式-json格式校验」、字段类型=「json」、质检结果=「校验通过」、未通过原因=「--」、详情说明=「符合规则key为"person-name;person-age"时的value格式要求」（源码 PRD line 135 文案）<br>4) 操作列不显示【查看明细】链接 |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P0】验证「格式-json格式校验」校验不通过主流程：规则集配置 + 导入规则包 + 执行任务 + 校验结果查询查看失败明细

> 前置条件

```
1) 使用 admin 账号登录系统
2) 数据源中心已添加数据源「测试数据源_SparkThrift2」（SparkThrift2.x）并授权给资产平台
3) 资产平台已引入该数据源 pw_test 数据库
4) 已在「通用配置 → json格式校验管理」中维护：
   - 「order-amount」，中文名称「订单金额」，value 格式正则 `^\d+\.\d{2}$`
   - 「order-status」，中文名称「订单状态」，value 格式正则 `^(pending|paid|cancelled)$`
5) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入包含不合规数据的数据：
   DROP TABLE IF EXISTS pw_test.json_invalid_test;
   CREATE TABLE pw_test.json_invalid_test (
     id INT,
     order_info STRING,
     remark STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_invalid_test
   SELECT 1, '{"order":{"amount":"100.00","status":"paid"}}',     'row_valid'
   UNION ALL
   SELECT 2, '{"order":{"amount":"abc","status":"unknown"}}',     'row_invalid'
   UNION ALL
   SELECT 3, '{"order":{"amount":"50.5","status":"pending"}}',    'row_invalid2';
6) 已在资产平台引入该表
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则集管理】页面，等待规则集列表加载完成，点击【新建规则集】 | 进入规则集 Step 1 基础信息页面 |
| 2    | 在 Step 1 基础信息中按顺序配置：<br>- *选择数据源：测试数据源_SparkThrift2<br>- *选择数据库：pw_test<br>- *选择数据表：json_invalid_test<br>- 规则集描述：（留空）<br>- *规则包名称：通过【新增】按钮添加「校验不通过测试包」<br>点击【下一步】 | Step 1 校验通过，进入 Step 2 监控规则页面 |
| 3    | 在 Step 2 中，在"校验不通过测试包"行点击【新增规则】，选择【有效性校验】，按以下配置：<br>- *规则类型：字段级<br>- *字段：order_info（string）<br>- *统计规则：格式-json格式校验<br>- *校验key：勾选「order-amount」「order-status」<br>- 强弱规则：强规则<br>- 过滤条件：（留空）<br>- 规则描述：（留空）<br>点击规则行【保存】，再点击页面底部【保存】 | 1) 规则集保存成功<br>2) 列表新增 json_invalid_test 表对应的规则集记录<br>3) 规则包"校验不通过测试包"下显示已保存的「格式-json格式校验」规则 |
| 4    | 进入【数据质量 → 规则任务管理】页面，点击【新建监控规则】，在 Step 1 中：<br>- *规则名称：json格式校验任务_不通过<br>- *选择数据源：测试数据源_SparkThrift2<br>- *选择数据库：pw_test<br>- *选择数据表：json_invalid_test<br>点击【下一步】 | Step 1 校验通过，进入 Step 2 监控规则页面 |
| 5    | 在 Step 2 中点击【导入规则包】，勾选规则集"校验不通过测试包"并确认 | 规则包导入成功 |
| 6    | 点击【下一步】进入 Step 3 调度属性，按默认配置后点击【保存】 | 规则任务创建成功，列表可查询到任务"json格式校验任务_不通过" |
| 7    | 在任务列表中找到"json格式校验任务_不通过"，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 8    | 进入【数据质量 → 校验结果查询】页面，点击"json格式校验任务_不通过"最新实例记录的**表名**展开实例详情 | 1) 本次执行生成新实例<br>2) 实例状态「已完成」，最新校验结果「校验不通过」<br>3) 实例详情中「格式-json格式校验」规则行展示：规则类型=「有效性校验」、规则名称=「格式-json格式校验」、字段类型=「json」、质检结果=「校验不通过」、未通过原因=「key对应value格式校验未通过」（PRD line 141）、详情说明=「不符合规则key为"order-amount;order-status"时的value格式要求」（PRD line 143）<br>4) 操作列显示【查看明细】链接（按 knowledge/data-quality.md §4，命名为「查看明细」非「查看详情」） |
| 9    | 点击「格式-json格式校验」规则行操作列的【查看明细】链接，等待明细弹窗加载 | 1) 弹窗标题「查看"有效性校验-格式-json格式校验"明细」（PRD line 65 文案）<br>2) 明细列表显示不符合要求的数据行（id=2、id=3）<br>3) 「order_info」字段以红色高亮标红展示，其余字段正常展示 |

> 使用 Doris3.x 数据源重复以上步骤，将 `order_info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 数据源兼容性

##### 【P1】验证「格式-json格式校验」规则在 SparkThrift 2.x 数据源下执行正确

> 前置条件

```
1) 使用 admin 账号登录系统
2) 数据源中心已添加 SparkThrift 2.x 数据源「测试数据源_Spark2」并授权给资产平台
3) 已在「通用配置 → json格式校验管理」中维护 key 路径「event-type」，中文名称「事件类型」，value 格式正则 `^(click|view|purchase)$`
4) 已在 SparkThrift2.x 数据源 spark_test_db 库执行以下 SQL 创建测试表并灌入数据：
   DROP TABLE IF EXISTS spark_test_db.json_event_test;
   CREATE TABLE spark_test_db.json_event_test (
     id INT,
     event_data STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE spark_test_db.json_event_test
   SELECT 1, '{"event":{"type":"click"}}'
   UNION ALL
   SELECT 2, '{"event":{"type":"unknown"}}';
5) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_spark2_compat"：Step 1 关联 SparkThrift2.x 数据源 spark_test_db.json_event_test 表，新增规则包"Spark2兼容性测试包"；Step 2 配置【有效性校验】规则：字段=event_data（string）、统计规则=格式-json格式校验、校验key=event-type、强弱规则=强规则；保存
6) 已通过【数据质量 → 规则任务管理】页面创建任务"Spark2兼容性测试任务"：Step 1 规则名称=Spark2兼容性测试任务，关联同一表；Step 2 通过【导入规则包】导入"Spark2兼容性测试包"；Step 3 保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 | 规则任务管理页面正常打开 |
| 2    | 找到「Spark2兼容性测试任务」，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 3    | 进入【数据质量 → 校验结果查询】页面，找到「Spark2兼容性测试任务」最新实例记录并打开实例详情 | 1) 本次执行生成新实例<br>2) 实例状态「已完成」，最新校验结果「校验不通过」<br>3) 实例详情中 id=1 记录质检结果=「校验通过」，id=2 记录因 event.type 值为「unknown」而质检结果=「校验不通过」 |

##### 【P1】验证「格式-json格式校验」规则在 Doris 3.x 数据源下执行正确

> 前置条件

```
1) 使用 admin 账号登录系统
2) 数据源中心已添加 Doris 3.x 数据源「测试数据源_Doris3」并授权给资产平台
3) 已在「通用配置 → json格式校验管理」中维护 key 路径「item-sku」，中文名称「商品SKU」，value 格式正则 `^SKU\d{8}$`
4) 已在 Doris3.x 数据源 quality_doris3_test 库执行以下 SQL 创建测试表并灌入数据：
   DROP TABLE IF EXISTS quality_doris3_test.json_sku_test;
   CREATE TABLE quality_doris3_test.json_sku_test (
     id INT,
     item_info JSON
   ) DISTRIBUTED BY HASH(id) BUCKETS 3 PROPERTIES ("replication_num" = "1");
   INSERT INTO quality_doris3_test.json_sku_test VALUES
     (1, '{"item":{"sku":"SKU12345678"}}'),
     (2, '{"item":{"sku":"invalid_sku"}}');
5) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_doris3_compat"：Step 1 关联 Doris3.x 数据源 quality_doris3_test.json_sku_test 表，新增规则包"Doris3兼容性测试包"；Step 2 配置【有效性校验】规则：字段=item_info（json）、统计规则=格式-json格式校验、校验key=item-sku、强弱规则=强规则；保存
6) 已通过【数据质量 → 规则任务管理】页面创建任务"Doris3兼容性测试任务"：关联同一 Doris3.x 表，Step 2 仅通过【导入规则包】导入"Doris3兼容性测试包"，Step 3 保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 | 规则任务管理页面正常打开 |
| 2    | 找到「Doris3兼容性测试任务」，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 3    | 进入【数据质量 → 校验结果查询】页面，找到「Doris3兼容性测试任务」最新实例记录并打开实例详情 | 1) 本次执行生成新实例<br>2) 实例状态「已完成」，最新校验结果「校验不通过」<br>3) 实例详情中 id=1 记录质检结果=「校验通过」，id=2 记录质检结果=「校验不通过」 |
| 4    | 点击「格式-json格式校验」规则行操作列的【查看明细】链接，等待明细弹窗加载 | 明细列表显示 id=2 的不合规记录，「item_info」字段以红色高亮标红展示 |

##### 【P1】验证「格式-json格式校验」规则在 Hive 2.x 数据源下执行正确

> 前置条件

```
1) 使用 admin 账号登录系统
2) 数据源中心已添加 Hive 2.x 数据源「测试数据源_Hive2」并授权给资产平台
3) 已在「通用配置 → json格式校验管理」中维护 key 路径「score-value」，中文名称「分数值」，value 格式正则 `^\d{1,3}$`
4) 已在 Hive2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入数据：
   DROP TABLE IF EXISTS pw_test.json_score_test;
   CREATE TABLE pw_test.json_score_test (
     id INT,
     score_info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_score_test
   SELECT 1, '{"score":{"value":"95"}}'
   UNION ALL
   SELECT 2, '{"score":{"value":"1000"}}';
5) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_hive2_compat"：Step 1 关联 Hive2.x 数据源 pw_test.json_score_test 表，新增规则包"Hive2兼容性测试包"；Step 2 配置【有效性校验】规则：字段=score_info（string）、统计规则=格式-json格式校验、校验key=score-value、强弱规则=强规则；保存
6) 已通过【数据质量 → 规则任务管理】页面创建任务"Hive2兼容性测试任务"：关联同一 Hive2.x 表，Step 2 仅通过【导入规则包】导入"Hive2兼容性测试包"，Step 3 保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 | 规则任务管理页面正常打开 |
| 2    | 找到「Hive2兼容性测试任务」，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 3    | 进入【数据质量 → 校验结果查询】页面，找到「Hive2兼容性测试任务」最新实例记录并打开实例详情 | 1) 本次执行生成新实例<br>2) 实例状态「已完成」，最新校验结果「校验不通过」<br>3) 实例详情中 id=1 记录质检结果=「校验通过」，id=2 记录因 score.value 值为「1000」（超出 1-999 范围）而质检结果=「校验不通过」 |

#### 大数据量场景

##### 【P1】验证 json 格式配置中维护上千个 key 时执行校验与结果展示正常

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 1200 条 key（1000 条配置 value 格式 + 200 条未配置）。Excel 生成脚本：

   import openpyxl
   wb = openpyxl.Workbook()
   ws = wb.active
   ws.title = "一层"
   ws.append(["key", "中文名称", "value格式"])
   for i in range(1, 1001):
       ws.append([f"perf-key-{i:04d}", f"性能键{i:04d}", "^.+$"])
   for i in range(1001, 1201):
       ws.append([f"perf-novalue-{i}", f"无格式键{i}", ""])
   wb.save("json_value_format_import_1200.xlsx")

3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入数据：
   DROP TABLE IF EXISTS pw_test.json_perf_test;
   CREATE TABLE pw_test.json_perf_test (
     id INT,
     big_info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_perf_test
   SELECT 1, '{"perf-key-0001":"value_1","perf-key-0002":"value_2"}'
   UNION ALL
   SELECT 2, '{"perf-key-0001":"","perf-key-0002":"value_2"}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_perf_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_perf_test 表，新增规则包"大数据量key校验包"；Step 2 配置【有效性校验】规则：字段=big_info（string）、统计规则=格式-json格式校验、校验key=perf-key-0001 + perf-key-0002、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"大数据量key校验任务"：关联同一表，Step 2 仅通过【导入规则包】导入"大数据量key校验包"，Step 3 保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 | 规则任务列表正常加载 |
| 2    | 找到「大数据量key校验任务」，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 3    | 进入【数据质量 → 校验结果查询】页面，找到「大数据量key校验任务」最新实例记录并打开实例详情 | 1) 本次执行生成新实例<br>2) 实例详情可正常打开，不出现超时、空白或报错<br>3) id=1 记录质检结果=「校验通过」，id=2 记录因 perf-key-0001 值为空而质检结果=「校验不通过」<br>4) 详情说明列准确引用校验key「perf-key-0001;perf-key-0002」 |

> 使用 Doris3.x 数据源重复以上步骤，将 `big_info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### key删除后关联影响

##### 【P1】验证删除已被有效性规则引用的 key 后规则配置页面回显与编辑功能正常

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护：
   - 「del-key-a」，中文名称「待删除键A」，value 格式正则 `^[A-Z]+$`
   - 「del-key-b」，中文名称「待删除键B」，value 格式正则 `^\d+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入数据：
   DROP TABLE IF EXISTS pw_test.json_del_test;
   CREATE TABLE pw_test.json_del_test (
     id INT,
     del_info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_del_test
   SELECT 1, '{"del":{"key":{"a":"ABC","b":"123"}}}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_key_del_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_del_test 表，新增规则包"key删除测试包"；Step 2 配置【有效性校验】规则：字段=del_info（string）、统计规则=格式-json格式校验、校验key=del-key-a + del-key-b、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"key删除影响测试任务"：关联同一表，Step 2 仅通过【导入规则包】导入"key删除测试包"，Step 3 保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【通用配置 → json格式校验管理】页面，等待列表加载完成 | json格式校验管理页面正常加载，列表中显示「del-key-a」和「del-key-b」 |
| 2    | 找到「del-key-a」行，点击操作列的【删除】按钮，在确认 Popconfirm 中点击【确认】（按 ui-autotest-pitfalls.md G5，源码导出/删除 Popconfirm 按钮文案以源码常量为准），等待删除完成 | 删除成功，列表中不再显示「del-key-a」，仅保留「del-key-b」 |
| 3    | 进入【数据质量 → 规则集管理】页面，找到规则集"rule_set_key_del_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面，查看「格式-json格式校验」规则行的「校验key」回显 | 规则配置页面正常加载；「校验key」列回显内容中「del-key-a」已从校验 key 列表中移除（源码 `JsonFormatConfiguration` 的 useEffect normalize 逻辑会过滤掉无效 value），「del-key-b」正常显示 |
| 4    | 点击该规则行的【编辑】按钮，展开「校验key」TreeSelect 下拉框 | 1) 下拉框正常打开<br>2) 列表中不再显示已删除的「del-key-a」<br>3) 「del-key-b」显示为已勾选状态 |
| 5    | 点击规则行【保存】 | 规则保存成功；规则行「校验key」列回显「del-key-b」 |

<!-- TODO[ambiguous]: 通用配置删除 Popconfirm 的按钮文案是「确认」还是「确定」未在 dt-center-assets dataAssets 项目源码中验证（仅在 ui-autotest-pitfalls.md G5 引用「json格式配置」试点的源码常量 DY=「确认」）。建议拍板方向：默认按 G5 源码常量「确认」，运行时若不符再回填。 -->

> 使用 Doris3.x 数据源重复以上步骤，将 `del_info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证删除已被规则引用的 key 后 value 格式预览弹窗与执行校验任务正常

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护：
   - 「preview-key-x」，中文名称「预览键X」，value 格式正则 `^[0-9]+$`
   - 「preview-key-y」，中文名称「预览键Y」，value 格式正则 `^[a-z]+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入数据：
   DROP TABLE IF EXISTS pw_test.json_preview_del;
   CREATE TABLE pw_test.json_preview_del (
     id INT,
     preview_info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_preview_del
   SELECT 1, '{"preview":{"key":{"x":"123","y":"abc"}}}'
   UNION ALL
   SELECT 2, '{"preview":{"key":{"x":"456","y":"def"}}}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_preview_del_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_preview_del 表，新增规则包"key删除预览测试包"；Step 2 配置【有效性校验】规则：字段=preview_info（string）、统计规则=格式-json格式校验、校验key=preview-key-x + preview-key-y、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"key删除预览测试任务"：关联同一表，Step 2 仅通过【导入规则包】导入"key删除预览测试包"，Step 3 保存
6) 已在「通用配置 → json格式校验管理」中删除「preview-key-x」
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 | 规则任务列表正常加载 |
| 2    | 进入【数据质量 → 规则集管理】页面，找到规则集"rule_set_preview_del_test"，点击操作列的【编辑】按钮，等待表单加载完成，点击【下一步】进入 Step 2 监控规则页面，找到「格式-json格式校验」规则行，点击【value格式预览】按钮，等待弹窗加载 | 弹窗正常打开，仅展示「preview-key-y」的格式信息，已删除的「preview-key-x」不在列表中 |
| 3    | 关闭弹窗，返回【数据质量 → 规则任务管理】页面，找到「key删除预览测试任务」，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 4    | 进入【数据质量 → 校验结果查询】页面，找到「key删除预览测试任务」最新实例记录并打开实例详情 | 1) 本次执行生成新实例<br>2) 实例状态「已完成」，最新校验结果「校验通过」<br>3) 实例详情中「格式-json格式校验」规则的详情说明仅引用「preview-key-y」，不再展示已删除的「preview-key-x」<br>4) 页面未出现引用已删除 key 的报错信息 |

> 使用 Doris3.x 数据源重复以上步骤，将 `preview_info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 抽样场景

##### 【P1】验证配置「格式-json格式校验」规则结合抽样功能执行校验结果正确

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「sample-code」，中文名称「样本编码」，value 格式正则 `^S\d{6}$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入 20 条数据：
   DROP TABLE IF EXISTS pw_test.json_sample_test;
   CREATE TABLE pw_test.json_sample_test (
     id INT,
     sample_info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_sample_test
   SELECT 1,  '{"sample":{"code":"S000001"}}'
   UNION ALL SELECT 2,  '{"sample":{"code":"S000002"}}'
   UNION ALL SELECT 3,  '{"sample":{"code":"S000003"}}'
   UNION ALL SELECT 4,  '{"sample":{"code":"S000004"}}'
   UNION ALL SELECT 5,  '{"sample":{"code":"S000005"}}'
   UNION ALL SELECT 6,  '{"sample":{"code":"S000006"}}'
   UNION ALL SELECT 7,  '{"sample":{"code":"S000007"}}'
   UNION ALL SELECT 8,  '{"sample":{"code":"S000008"}}'
   UNION ALL SELECT 9,  '{"sample":{"code":"S000009"}}'
   UNION ALL SELECT 10, '{"sample":{"code":"S000010"}}'
   UNION ALL SELECT 11, '{"sample":{"code":"invalid1"}}'
   UNION ALL SELECT 12, '{"sample":{"code":"invalid2"}}'
   UNION ALL SELECT 13, '{"sample":{"code":"S000013"}}'
   UNION ALL SELECT 14, '{"sample":{"code":"S000014"}}'
   UNION ALL SELECT 15, '{"sample":{"code":"S000015"}}'
   UNION ALL SELECT 16, '{"sample":{"code":"S000016"}}'
   UNION ALL SELECT 17, '{"sample":{"code":"S000017"}}'
   UNION ALL SELECT 18, '{"sample":{"code":"S000018"}}'
   UNION ALL SELECT 19, '{"sample":{"code":"S000019"}}'
   UNION ALL SELECT 20, '{"sample":{"code":"S000020"}}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_sample_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_sample_test 表，新增规则包"抽样校验测试包"；Step 2 配置【有效性校验】规则：字段=sample_info（string）、统计规则=格式-json格式校验、校验key=sample-code、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"抽样校验测试任务"：关联同一表，Step 2 仅通过【导入规则包】导入"抽样校验测试包"；Step 1 抽样检查设置中设置抽样比例为 50%；Step 3 保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 | 规则任务列表正常加载 |
| 2    | 找到「抽样校验测试任务」，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 3    | 进入【数据质量 → 校验结果查询】页面，找到「抽样校验测试任务」最新实例记录并打开实例详情 | 1) 本次执行生成新实例<br>2) 实例详情中统计信息显示参与校验的数据量约为总数据量的 50%（约 10 条）<br>3) 「格式-json格式校验」规则行的质检结果反映本次抽样后的实际校验结果（id=11、id=12 的无效数据若被抽中则结果为「校验不通过」，否则为「校验通过」）<br>4) 详情说明列准确显示校验key=「sample-code」 |

> 使用 Doris3.x 数据源重复以上步骤，将 `sample_info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

#### 分区场景

##### 【P1】验证对分区表配置「格式-json格式校验」规则后指定分区下的数据校验正确

> 前置条件

```
1) 使用 admin 账号登录系统
2) 数据源中心已添加 Hive 2.x 数据源「测试数据源_Hive2」并授权给资产平台
3) 已在「通用配置 → json格式校验管理」中维护 key 路径「part-code」，中文名称「分区编码」，value 格式正则 `^P\d{4}$`
4) 已在 Hive2.x 数据源 pw_test 库执行以下 SQL 创建分区表并灌入数据：
   DROP TABLE IF EXISTS pw_test.json_partition_test;
   CREATE TABLE pw_test.json_partition_test (
     id INT,
     part_info STRING
   ) PARTITIONED BY (dt STRING)
   ROW FORMAT DELIMITED FIELDS TERMINATED BY ',';
   ALTER TABLE pw_test.json_partition_test ADD PARTITION (dt='2026-04-01');
   ALTER TABLE pw_test.json_partition_test ADD PARTITION (dt='2026-04-02');
   INSERT INTO pw_test.json_partition_test PARTITION (dt='2026-04-01') VALUES
     (1, '{"part":{"code":"P0001"}}'),
     (2, '{"part":{"code":"invalid"}}');
   INSERT INTO pw_test.json_partition_test PARTITION (dt='2026-04-02') VALUES
     (3, '{"part":{"code":"P0003"}}'),
     (4, '{"part":{"code":"P0004"}}');
5) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_partition_test"：Step 1 关联 Hive2.x 数据源 pw_test.json_partition_test 表，新增规则包"分区校验测试包"；Step 2 配置【有效性校验】规则：字段=part_info（string）、统计规则=格式-json格式校验、校验key=part-code、强弱规则=强规则、过滤条件=`dt = '2026-04-01'`；保存
6) 已通过【数据质量 → 规则任务管理】页面创建任务"分区校验测试任务"：关联同一 Hive 分区表，Step 2 仅通过【导入规则包】导入"分区校验测试包"，Step 3 保存
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则任务管理】页面，等待规则任务列表加载完成 | 规则任务列表正常加载 |
| 2    | 找到「分区校验测试任务」，点击行**表名**展开抽屉，在抽屉中点击【立即执行】 | 任务已提交执行 |
| 3    | 进入【数据质量 → 校验结果查询】页面，找到「分区校验测试任务」最新实例记录并打开实例详情 | 1) 本次执行生成新实例<br>2) 仅校验 `dt='2026-04-01'` 分区下的数据（id=1、id=2）<br>3) id=1 记录质检结果=「校验通过」，id=2 记录质检结果=「校验不通过」<br>4) `dt='2026-04-02'` 分区的数据（id=3、id=4）不参与本次校验 |

### 规则库配置

#### 规则库-内置规则展示

##### 【P1】验证规则库中「格式-json格式校验」内置规则展示信息正确

> 前置条件

```
1) 使用 admin 账号登录系统
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 规则库配置】页面，切换到「内置规则」Tab，等待内置规则列表加载完成 | 规则库页面正常加载，「内置规则」Tab 列表展示完成 |
| 2    | 在「内置规则」列表的搜索框中输入「格式-json格式校验」，等待结果过滤 | 搜索结果展示「格式-json格式校验」规则条目，各字段显示：<br>1) 函数名称（规则名称）=「格式-json格式校验」<br>2) 函数说明（规则解释）=「格式-json格式校验」（PRD line 159 文案）<br>3) 规则任务类型（规则分类）=「有效性校验」<br>4) 关联范围=「字段」<br>5) 规则描述=「校验json类型的字段中key对应的value值是否符合规范要求」（PRD line 165 文案） |
| 3    | 点击页面右上角【导出】按钮，等待文件下载完成 | 1) 文件成功下载（Excel 格式）<br>2) 文件中存在「格式-json格式校验」对应行，规则分类列为「有效性校验」 |

<!-- TODO[ambiguous]: 该用例为纯 UI 验证，不涉及具体数据源执行，原本的"使用 Doris3.x 数据源重复"句式不适用，已删除。 -->

### 校验结果查询

#### 校验明细与日志

##### 【P1】验证校验不通过时明细数据下载文件中校验字段标红

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护：
   - 「product-code」，中文名称「产品编码」，value 格式正则 `^[A-Z]{2}\d{6}$`
   - 「product-price」，中文名称「产品价格」，value 格式正则 `^\d+\.\d{2}$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入包含不合规数据的数据：
   DROP TABLE IF EXISTS pw_test.json_dl_test;
   CREATE TABLE pw_test.json_dl_test (
     id INT,
     payload STRING,
     name STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_dl_test
   SELECT 1, '{"product":{"code":"AB123456","price":"100.00"}}', 'valid'
   UNION ALL
   SELECT 2, '{"product":{"code":"invalid_code","price":"abc"}}', 'invalid';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_dl_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_dl_test 表，新增规则包"下载明细测试包"；Step 2 配置【有效性校验】规则：字段=payload（string）、统计规则=格式-json格式校验、校验key=product-code + product-price、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"下载明细测试任务"：关联同一表，Step 2 仅通过【导入规则包】导入"下载明细测试包"，Step 3 保存；任务列表点击【立即执行】，等待执行完成（最新校验结果为「校验不通过」）
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 校验结果查询】页面，等待页面加载完成 | 校验结果查询页面正常打开，列表加载完成 |
| 2    | 找到「下载明细测试任务」最新实例记录的**表名**展开实例详情，点击「格式-json格式校验」规则行操作列的【查看明细】链接，等待明细弹窗加载 | 明细弹窗打开，显示不符合规则的数据行（id=2 记录） |
| 3    | 在明细弹窗中点击【下载明细数据】按钮，等待文件下载完成 | 文件成功下载，文件格式为 Excel（.xlsx） |
| 4    | 打开下载的 Excel 文件，查看校验字段（payload 列）中不符合规则记录的单元格样式 | 1) 文件内容包含全部字段列（id、payload、name）<br>2) 「payload」列（校验字段）以红色标记展示（PRD line 67 「下载明细数据中校验字段也标红展示」）<br>3) 其他字段列正常展示 |

> 使用 Doris3.x 数据源重复以上步骤，将 `payload` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证校验通过时不记录明细数据，查看明细入口不显示

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「meta-version」，中文名称「版本号」，value 格式正则 `^v\d+\.\d+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入合规数据：
   DROP TABLE IF EXISTS pw_test.json_pass_test;
   CREATE TABLE pw_test.json_pass_test (
     id INT,
     info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_pass_test
   SELECT 1, '{"meta":{"version":"v1.0"}}'
   UNION ALL
   SELECT 2, '{"meta":{"version":"v2.5"}}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_pass_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_pass_test 表，新增规则包"通过场景测试包"；Step 2 配置【有效性校验】规则：字段=info（string）、统计规则=格式-json格式校验、校验key=meta-version、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"通过场景测试任务"：关联同一表，Step 2 仅通过【导入规则包】导入"通过场景测试包"，Step 3 保存；任务列表点击【立即执行】，等待执行完成（最新校验结果为「校验通过」）
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 校验结果查询】页面，等待页面加载完成 | 校验结果查询页面正常打开，列表加载完成 |
| 2    | 找到「通过场景测试任务」最新实例记录的**表名**展开实例详情 | 实例详情正常打开，数据加载完成 |
| 3    | 找到「格式-json格式校验」规则行，查看「质检结果」「未通过原因」「操作」列内容 | 1) 「质检结果」列显示「校验通过」<br>2) 「未通过原因」列显示「--」（PRD line 133）<br>3) 「操作」列不显示【查看明细】链接（PRD line 71「针对"校验通过"的规则，不记录明细数据」） |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P2】验证校验失败（任务运行失败）时支持查看日志

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已通过【数据质量 → 规则集管理】页面配置「格式-json格式校验」规则集；并通过【数据质量 → 规则任务管理】页面，点击【新建监控规则】创建任务"日志查看测试任务"，Step 2 仅通过【导入规则包】导入该规则集的规则包，Step 3 保持默认调度配置后点击【保存】
3) 已将该任务关联数据源的连接地址临时修改为不可达地址；任务列表点击【立即执行】，使【数据质量 → 校验结果查询】页面生成该任务执行状态为「校验失败」的最新实例记录（按 knowledge/data-quality.md §4，「校验失败」语义包含 SQL 错误 / 引擎异常）
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 校验结果查询】页面，等待页面加载完成 | 校验结果查询页面正常打开，列表加载完成 |
| 2    | 找到「日志查看测试任务」执行状态为「校验失败」的最新实例记录，点击操作列的【查看日志】按钮，等待日志内容加载 | 1) 日志弹窗正常打开<br>2) 显示本次任务执行的错误日志内容<br>3) 日志内容包含数据源连接异常的错误描述<br>4) 不显示空白页 |

<!-- TODO[ambiguous]: 该用例为偏运维场景，原本的"使用 Doris3.x 数据源重复"句式适用性较低（更换数据源仅会改变错误堆栈），已删除句式。 -->

### 数据质量报告

#### 质量报告展示

##### 【P1】验证质量报告中「格式-json格式校验」规则行各列字段展示正确（校验通过场景）

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护 key 路径「meta-version」，中文名称「版本号」，value 格式正则 `^v\d+\.\d+$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入合规数据：
   DROP TABLE IF EXISTS pw_test.json_report_pass;
   CREATE TABLE pw_test.json_report_pass (
     id INT,
     info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_report_pass
   SELECT 1, '{"meta":{"version":"v1.0"}}'
   UNION ALL
   SELECT 2, '{"meta":{"version":"v2.3"}}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_report_pass_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_report_pass 表，新增规则包"报告通过测试包"；Step 2 配置【有效性校验】规则：字段=info（string）、统计规则=格式-json格式校验、校验key=meta-version、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"报告通过展示任务"：关联同一表，Step 2 仅通过【导入规则包】导入"报告通过测试包"，Step 3 保存；任务列表点击【立即执行】，等待执行完成（最新校验结果为「校验通过」）
6) 已通过【数据质量 → 数据质量报告】页面为该任务创建一次性报告，等待 ~15 分钟报告生成完成（按 knowledge/data-quality.md §5）
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 数据质量报告】页面，等待页面加载完成 | 数据质量报告页面正常打开，报告列表加载完成 |
| 2    | 找到「报告通过展示任务」最新一次执行的报告，点击进入报告详情 | 报告详情页正常打开，数据加载完成 |
| 3    | 找到「格式-json格式校验」规则行，逐列核对各字段内容 | 1) 规则类型列=「有效性校验」<br>2) 规则名称列=「格式-json格式校验」<br>3) 字段类型列=「json」（PRD line 129）<br>4) 质检结果列=「校验通过」<br>5) 未通过原因列=「--」<br>6) 详情说明列=「符合规则key为"meta-version"时的value格式要求」<br>7) 操作列无内容 |

> 使用 Doris3.x 数据源重复以上步骤，将 `info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。

##### 【P1】验证质量报告中「格式-json格式校验」规则行各列字段展示正确（校验不通过场景）

> 前置条件

```
1) 使用 admin 账号登录系统
2) 已在「通用配置 → json格式校验管理」中维护：
   - 「log-level」，中文名称「日志级别」，value 格式正则 `^(INFO|WARN|ERROR)$`
   - 「log-code」，中文名称「日志编码」，value 格式正则 `^[A-Z]{3}\d{5}$`
3) 已在 SparkThrift2.x 数据源 pw_test 库执行以下 SQL 创建测试表并灌入包含不合规数据的数据：
   DROP TABLE IF EXISTS pw_test.json_report_fail;
   CREATE TABLE pw_test.json_report_fail (
     id INT,
     log_info STRING
   ) STORED AS PARQUET;
   INSERT INTO TABLE pw_test.json_report_fail
   SELECT 1, '{"log":{"level":"INFO","code":"ERR00001"}}'
   UNION ALL
   SELECT 2, '{"log":{"level":"DEBUG","code":"invalid"}}';
4) 已通过【数据质量 → 规则集管理】页面创建规则集"rule_set_report_fail_test"：Step 1 关联 SparkThrift2.x 数据源 pw_test.json_report_fail 表，新增规则包"报告不通过测试包"；Step 2 配置【有效性校验】规则：字段=log_info（string）、统计规则=格式-json格式校验、校验key=log-level + log-code、强弱规则=强规则；保存
5) 已通过【数据质量 → 规则任务管理】页面创建任务"报告不通过展示任务"：关联同一表，Step 2 仅通过【导入规则包】导入"报告不通过测试包"，Step 3 保存；任务列表点击【立即执行】，等待执行完成（最新校验结果为「校验不通过」）
6) 已通过【数据质量 → 数据质量报告】页面为该任务创建一次性报告，等待 ~15 分钟报告生成完成
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1    | 进入【数据质量 → 数据质量报告】页面，等待页面加载完成 | 数据质量报告页面正常打开，报告列表加载完成 |
| 2    | 找到「报告不通过展示任务」最新一次执行的报告，点击进入报告详情 | 报告详情页正常打开，数据加载完成 |
| 3    | 找到「格式-json格式校验」规则行，逐列核对各字段内容 | 1) 规则类型列=「有效性校验」<br>2) 规则名称列=「格式-json格式校验」<br>3) 字段类型列=「json」<br>4) 质检结果列=「校验不通过」<br>5) 未通过原因列=「key对应value格式校验未通过」<br>6) 详情说明列=「不符合规则key为"log-level;log-code"时的value格式要求」<br>7) 操作列显示【查看明细】链接 |

> 使用 Doris3.x 数据源重复以上步骤，将 `log_info` 字段类型从 `STRING` 改为 `JSON`，其余 UI 操作不变；预期结果与 SparkThrift2.x 一致。
