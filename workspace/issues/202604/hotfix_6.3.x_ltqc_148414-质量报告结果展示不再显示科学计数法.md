---
suite_name: "Hotfix 用例 - 质量报告结果展示不再显示科学计数法"
description: "验证 Bug #148414 修复效果"
tags:
  - hotfix
  - bug-148414
create_at: "2026-04-13"
status: 草稿
origin: zentao
---

## 数据质量

### 质量报告

#### 报告详情异常数据展示

##### 【148414】验证质量报告异常数据明细中的数值结果以常规数字格式展示

> 前置条件

```
1、环境要求：岚图环境已部署 customltem/DatasourceX 的 hotfix_6.3.x_ltqc_148414 修复版本；测试账号可访问数据质量项目。

2、数据准备：
（1）在已绑定到质量项目的数据源中准备测试表。以下 SQL 以 MySQL 为例；如当前项目使用 Spark/Hive，请按等价字段类型建表并写入相同测试值：

DROP TABLE IF EXISTS ltqc_quality_report_148414;
CREATE TABLE ltqc_quality_report_148414 (
  id BIGINT PRIMARY KEY,
  vin VARCHAR(32),
  measure_double DOUBLE,
  measure_decimal DECIMAL(20,10)
);

INSERT INTO ltqc_quality_report_148414 (id, vin, measure_double, measure_decimal) VALUES
  (1, 'LTQC148414A', 123456789012.34567, 1234567890.1234567890),
  (2, 'LTQC148414B', 0.000000123456, 0.0000001234);

（2）在【数据质量 > 规则任务管理】中，已存在针对表 ltqc_quality_report_148414 的字段规则，保证上述两条数据会进入异常明细；例如对字段 measure_double 配置“取值范围 0.0001 ~ 1000”。
（3）在【数据质量 > 质量报告 > 已配置报告】中，已存在报告 ltqc_quality_report_148414，关联表 ltqc_quality_report_148414，并且已成功生成一条报告记录。

3、账号要求：具备 DATAVALID_REPORT_VIEW 权限；若需重跑或补生成报告，账号还需具备 DATAVALID_REPORT_OPERATION 权限。
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1 | 使用有权限账号登录系统，进入左侧菜单【数据质量 > 质量报告】 | 页面正常加载，顶部可见页签【已配置报告】、【已生成报告】 |
| 2 | 切换到【已生成报告】页签，在【报告名称】输入框中输入 `ltqc_quality_report_148414`，点击【查询】 | 列表返回目标报告，报告状态为成功，操作列可见【报告详情】 |
| 3 | 点击目标报告操作列【报告详情】 | 跳转到质量报告详情页，页面顶部显示面包屑和【报告时间】信息，页面内容正常渲染 |
| 4 | 在详情页定位到测试表 ltqc_quality_report_148414 对应的“质量评估汇总”卡片，在【规则校验明细 > 字段规则】区域找到针对字段 measure_double 的失败规则，点击操作列【查看详情】 | 打开“查看…明细”抽屉，顶部可见【运行时间】下拉框和【下载明细】按钮，明细表格正常加载 |
| 5 | 若抽屉中存在多次运行记录，在【运行时间】下拉框中选择最新一次运行；横向滚动明细表格，定位到 measure_double、measure_decimal 两列 | 明细表格中可见插入的测试记录 LTQC148414A、LTQC148414B，两列数值均已正常返回 |
| 6 | 核对 LTQC148414A 这一行的 measure_double、measure_decimal 展示值 | measure_double 显示为 `123456789012.34567`，measure_decimal 显示为 `1234567890.1234567890`，页面中不出现 `1.2345678901234567E11` 或其他科学计数法文本 |
| 7 | 核对 LTQC148414B 这一行的 measure_double、measure_decimal 展示值 | measure_double 显示为 `0.000000123456`，measure_decimal 显示为 `0.0000001234`，页面中不出现 `1.23456E-7`、`1.234E-7` 等科学计数法文本 |
