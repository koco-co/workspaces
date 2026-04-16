---
suite_name: "Hotfix 用例 - 数据标准落标检查浮点数/定点数类型检查项结果展示优化"
description: "验证 Bug #145863 修复效果"
tags:
  - hotfix
  - bug-145863
create_at: "2026-04-16"
status: 草稿
origin: zentao
---

## 数据标准

### 落标检查

#### 检查项脏数据明细展示

##### 【145863】验证落标检查脏数据明细中浮点数/定点数字段以完整精度格式展示，不出现科学计数法

> 前置条件

```
1、环境要求：岚图环境已部署 dt-center-metadata 的 hotfix_6.3.x_ltqc_145863 修复版本；测试账号可访问【数据标准】相关菜单。

2、资源要求：已准备 sparkthrift2.x（或 Hive）类型数据源 `{{sparkthrift2.x数据源}}`，并确认当前项目下存在可用资源组 `{{资源组}}`。

3、账号要求：具备数据标准管理（新建标准、发布落标）、落标检查查看及操作权限。

4、测试表准备 SQL：在 `{{sparkthrift2.x数据源}}` 对应测试库执行以下 SQL，准备含浮点数/定点数/整数/NULL 的检测表。

DROP TABLE IF EXISTS ltqc_standard_check_145863;
CREATE TABLE ltqc_standard_check_145863 (
  id        BIGINT,
  col_float FLOAT,
  col_double DOUBLE,
  col_decimal DECIMAL(20, 10),
  col_int   INT,
  col_null  DOUBLE
)
STORED AS PARQUET;

INSERT INTO TABLE ltqc_standard_check_145863
SELECT 1, CAST(123456789012.34567 AS FLOAT),  CAST(123456789012.34567 AS DOUBLE),  CAST(1234567890.1234567890 AS DECIMAL(20,10)), 100, NULL
UNION ALL
SELECT 2, CAST(0.000000123456 AS FLOAT),      CAST(0.000000123456 AS DOUBLE),      CAST(0.0000001234 AS DECIMAL(20,10)),            200, NULL
UNION ALL
SELECT 3, CAST(1.5 AS FLOAT),                 CAST(1.5 AS DOUBLE),                 CAST(1.5000000000 AS DECIMAL(20,10)),            300, 1.5;
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1 | 登录系统，进入【离线开发】，新建一个【Spark SQL】任务，在 `{{sparkthrift2.x数据源}}` 对应测试库执行前置 SQL | SQL 执行成功，表 `ltqc_standard_check_145863` 创建完成；共 3 条测试数据，第 1、2 行含超大/超小数值，第 3 行为普通小数，第 1、2 行的 `col_null` 为 NULL |
| 2 | 进入【数据标准 > 标准管理】，新建一个数据标准；在【标准定义】中添加一条字段映射，选择数据源 `{{sparkthrift2.x数据源}}`、目标库、表 `ltqc_standard_check_145863`；发布该标准并触发落标检查（或在【落标管理】中手动发起检查任务） | 落标检查任务提交成功，任务开始执行 |
| 3 | 等待落标检查任务执行完成后，进入【数据标准 > 落标管理】（或【检查项结果】），找到 `ltqc_standard_check_145863` 对应的检查记录，点击【查看明细】或【脏数据明细】 | 抽屉/弹窗打开，展示脏数据明细表格，可见 `col_float`、`col_double`、`col_decimal`、`col_int`、`col_null` 列 |
| 4 | 核对第 1 行（id=1）的 `col_double` 展示值 | 显示为 `123456789012.34567`，不出现 `1.2345678901234567E11` 等科学计数法文本 |
| 5 | 核对第 2 行（id=2）的 `col_double` 展示值 | 显示为 `1.23456E-7` 对应的完整格式 `0.000000123456`，不出现科学计数法文本 |
| 6 | 核对第 1 行（id=1）和第 2 行（id=2）的 `col_decimal` 展示值 | 分别显示为 `1234567890.1234567890` 和 `0.0000001234`，精度完整，不丢失小数位 |
| 7 | 核对第 3 行（id=3）的 `col_float`、`col_double`、`col_decimal` 展示值 | 分别显示为 `1.5`、`1.5`、`1.5000000000`，普通小数正常显示，无异常 |
| 8 | 核对所有行的 `col_int` 展示值 | 分别显示为 `100`、`200`、`300`，整数类型字段展示不受本次修复影响，无额外小数点或格式变化 |
| 9 | 核对第 1 行和第 2 行的 `col_null` 展示值 | 显示为空（NULL），不报错，页面正常渲染 |
