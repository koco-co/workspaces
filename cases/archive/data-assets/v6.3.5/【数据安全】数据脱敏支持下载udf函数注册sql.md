---
suite_name: 【数据安全】数据脱敏支持下载udf函数注册sql v6.3.5
description: 【数据安全】数据脱敏支持下载udf函数注册sql v6.3.5
prd_id: 15693
prd_version: v6.3.5
prd_path: cases/requirements/data-assets/v6.4.10/.trash/PRD-15693-raw.md
product: data-assets
tags:
  - 数据资产
  - 数据资产-数据安全
  - 数据安全
  - 数据脱敏支持下载udf函数注册sql
create_at: 2026-03-29
status: ""
health_warnings: []
case_count: 1
origin: csv
---
> 来源：zentao-cases/dtstack-platform/数据资产/archive-cases/v6.3.5/【数据安全】数据脱敏支持下载udf函数注册sql.csv
> 用例数：1

---

## 数据资产-数据安全

##### 【P1】验证udf函数下载功能

> 前置条件
```
无
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据安全-数据脱敏管理-脱敏应用-添加脱敏表】页面，选择doris数据源 | 在数据源类型上方弹出提示内容 |
| 2 | 点击下载按钮 | 下载成功，系统给出成功反馈，相关页面/数据状态更新为最新 |
| 3 | 查看下载的内容 | 为udf函数jar包和执行sql信息的压缩包 |

