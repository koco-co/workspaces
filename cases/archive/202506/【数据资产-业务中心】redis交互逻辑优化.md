---
suite_name: 【数据资产-业务中心】redis交互逻辑优化 v6.3.4
description: 【数据资产-业务中心】redis交互逻辑优化 v6.3.4
prd_id: 15693
prd_version: v6.3.4
prd_path: cases/requirements/data-assets/v6.4.10/.trash/PRD-15693-raw.md
product: data-assets
tags:
  - 数据资产
  - 业务中心
  - redis交互逻辑优化
create_at: 2026-03-29
status: ""
health_warnings: []
case_count: 1
origin: csv
---
> 来源：zentao-cases/dtstack-platform/数据资产/archive-cases/v6.3.4/【数据资产-业务中心】redis交互逻辑优化.csv
> 用例数：1

---

## 数据资产

##### 【P2】验证数据级别权限申请审批功能是否正常

> 前置条件
```
无；1）普通用户
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据安全-级别管理】页面，点击机密后的申请权限2）挂掉metadata，管理员审批拒绝3）重启metadata，查看分级数据 | 成功进入数据安全-级别管理，点击机密后的申请权限2）挂掉metadata，管理员审批拒绝3）重启metadata，查看分级数据，页面内容正常加载显示，无报错 |
| 2 |  | （补充：2. 依旧未拥有分级数据为机密的查看权限） |

