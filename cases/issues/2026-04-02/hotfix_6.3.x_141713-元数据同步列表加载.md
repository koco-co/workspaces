---
suite_name: "在线问题转化-141713-元数据同步列表加载"
description: "验证底层库为DmMySQL时，元数据同步不因SQL缺少逗号而查不出数据（Bug：元数据同步点击底层执行sql报错，导致元数据同步查不出来数据）"
product: "metadata"
dev_version: "hotfix_6.3.x_141713"
tags:
  - hotfix
  - online-case
  - 元数据同步
  - DmMySQL
  - 周期同步
keywords: "6.3|元数据同步|达梦DmMySQL||6.3|SQL SELECT子句缺少逗号"
create_at: "2026-04-02"
update_at: "2026-04-02"
status: "草稿"
health_warnings: []
repos:
  - ".repos/dt-insight-web/dt-center-metadata"
case_count: 1
origin: json
---

## 问题背景 / 来源说明

- **禅道 Bug**：[#141713](http://zenpms.dtstack.cn/zentao/bug-view-141713.html)
- **Bug 标题**：【数据资产】元数据同步点击底层执行sql报错，导致元数据同步查不出来数据
- **严重级别**：3
- **当前状态**：in process（指派：可颂）
- **修复分支**：`hotfix_6.3.x_141713`（仓库：`dt-insight-web/dt-center-metadata`）
- **修复提交**：`c0b59aa12`（2025-12-04）
- **修复内容**：`dao/src/main/resources/dmMysqlMapper/sync/SyncTaskMapper.xml` 中 `pageTask` 查询的 SELECT 子句，`dataSource.data_source_name` 后缺少英文逗号，导致 DmMySQL 环境下 SQL 语法错误，整个周期同步任务列表接口报错无法加载。

---

## 测试用例

##### 【141713】验证底层库为DmMySQL时元数据周期同步任务列表正常加载

**前置条件：**

> - 当前系统底层库配置为达梦数据库（DaMeng）MySQL 兼容模式（`spring.sql.init.platform=dm-mysql`）
> - 数据资产平台已正常部署，能正常登录
> - 已在「数据源管理」中注册至少一个可用数据源（如 MySQL 类型，连接测试通过）

**测试步骤：**

1. 使用有效账号登录数据资产平台

2. 在顶部导航点击【元数据】，进入【元数据 → 元数据同步】页面

3. 确认当前默认展示【周期同步】标签页（若未选中，手动点击切换）

4. 点击右上角「新增周期同步任务」按钮，进入新增向导第一步「同步内容」

5. 在「数据源」下拉框中选择已注册的数据源（示例：选择 `test_mysql_datasource`），选择至少一个数据库（示例：`test_db`），点击「下一步」

6. 在向导第二步「调度配置」中：
   - 调度周期选择「每天」，配置一个具体执行时间（示例：`03:00`）
   - 确认其他配置项默认即可，点击「新增」完成任务创建

7. 返回【周期同步】列表页，观察列表加载情况及新增任务是否出现在列表中

**预期结果：**

修复前：进入【元数据 → 元数据同步 → 周期同步】页面后，列表区域加载失败（接口报错，原因为 DmMySQL Mapper 中 `pageTask` SQL SELECT 子句 `data_source_name` 后缺少英文逗号导致 SQL 语法异常），页面显示错误提示或列表一直转圈无数据

修复后：【周期同步】列表正常加载，第 6 步新增的同步任务出现在列表中，列表各列（数据源、数据库、调度周期、同步状态、最近一次实例状态、操作等）展示内容正确，无报错提示
