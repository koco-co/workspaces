---
suite_name: "Hotfix 用例 - 规范建表词根翻译改为整词匹配"
description: "验证 Bug #148219 修复效果 - 标准建表中未命中整词的中文名不再通过分词拼接出词根翻译"
tags:
  - hotfix
  - bug-148219
  - 元数据
  - 数据模型
  - 规范建表
  - 词根
create_at: "2026-04-14"
status: 草稿
origin: zentao
---

## 数据模型

### 规范建表

#### 词根翻译整词匹配

##### 【148219】验证标准建表词根翻译只匹配整词，未命中时不再拆词拼接

> 前置条件
```
1、环境要求：
- 已部署包含 hotfix_6.3.x_148219 修复的 dt-center-metadata 服务。
- 数据资产前端可正常访问，且【数据模型 > 规范建表】菜单可用。
- 测试账号同时具备“词根管理”和“规范建表”访问权限。

2、数据准备：
- 记录当前租户 ID（tenantId）与测试账号 userId。
- 若环境中已存在可复用词根，可跳过插数；否则执行以下 SQL 准备 1 条整词命中数据和 2 条拆词数据（执行前替换 #{tenantId}、#{userId}）：

DELETE FROM metadata_standard_root
WHERE tenant_id = #{tenantId}
  AND is_deleted = 0
  AND root_abbreviation IN ('cust_id', 'user', 'info');

INSERT INTO metadata_standard_root
    (create_by, update_by, root_abbreviation, root_full_name, root_cn, quote_count, tenant_id)
VALUES
    (#{userId}, #{userId}, 'cust_id', 'customer_id', '客户编号', 0, #{tenantId}),
    (#{userId}, #{userId}, 'user', 'user', '用户', 0, #{tenantId}),
    (#{userId}, #{userId}, 'info', 'information', '信息', 0, #{tenantId});

- 插入后执行以下 SQL 确认测试词根已生效：

SELECT root_abbreviation, root_full_name, root_cn
FROM metadata_standard_root
WHERE tenant_id = #{tenantId}
  AND is_deleted = 0
  AND root_abbreviation IN ('cust_id', 'user', 'info');

3、接口说明（供步骤校验使用）：
- 词根精确匹配接口：POST /dmetadata/v1/standardRoot/matchRoot
- 规范建表批量解析接口：POST /dmetadata/v1/dataWarehouseTable/nameParseColumn

4、代码变更说明（供验证参考）：
- 本次 Hotfix 仅修改 `dt-center-metadata/service/src/main/java/com/dtstack/metadata/service/standard/StandardRootService.java`。
- 修复前：`matchRoot(search)` 在整词未命中后，会继续调用 `wordAnalysisUtil.parse(search, tenantId, true)` 对中文名分词，再把命中的多个词根简称/全称拼接后返回。
- 修复后：`matchRoot(search)` 只做整词匹配；若未命中整词，直接返回 null，不再把“用户信息”之类的中文名拆成“用户 + 信息”后拼接出字段名。
- 规范建表的批量解析接口 `POST /dmetadata/v1/dataWarehouseTable/nameParseColumn` 在标准未命中时，会继续调用 `standardRootService.matchRoot(columnNameCn)`，因此本次修复会直接影响【规范建表 > 新建表】里的字段解析结果。
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| ---- | ---- | ---- |
| 1 | 使用已登录系统的浏览器 Cookie、Token 或 Apifox 会话，调用 `POST /dmetadata/v1/standardRoot/matchRoot`，请求体为 `{"search":"客户编号"}` | 接口返回 `success=true`；`data.rootCn` 为 `客户编号`，`data.rootAbbreviation` 为 `cust_id`，`data.rootFullName` 为 `customer_id`，说明整词命中后仍能返回正确的词根简称和全称 |
| 2 | 再次调用 `POST /dmetadata/v1/standardRoot/matchRoot`，请求体为 `{"search":"用户信息"}` | 接口返回 `success=true`；`data` 为 `null` 或空值，不返回 `rootAbbreviation`、`rootFullName`；不会把“用户信息”拆成“用户 + 信息”后拼接出 `user_info` 一类结果 |
| 3 | 登录系统，导航至【数据模型 > 规范建表】，确认当前路由为 `/builtSpecificationTable` | 页面正常加载，列表展示“表名、表中文名、表来源、表类型、所属数据源、所属数据库”等字段，右上角可见【新建表】按钮 |
| 4 | 点击【新建表】，进入 `/builtSpecificationTable/editBatch` | 打开“规范建表 > 新建表”页面，步骤条显示“基础信息 / 表结构” |
| 5 | 在“基础信息”步骤选择一个可建表的数据源和数据库，填写合法表名、表中文名后点击【下一步】 | 成功进入“表结构”步骤，无必填校验报错 |
| 6 | 在“表结构”步骤切换到【批量解析模式】，输入两行字段中文名：`客户编号`、`用户信息`，点击【解析】 | 页面生成 2 条字段记录，不出现“获取建表语句失败”等异常提示 |
| 7 | 查看第 1 条“客户编号”记录 | 中文名保留为 `客户编号`，字段名自动带出 `cust_id`，字段可继续参与后续建表流程，说明整词命中场景未被 Hotfix 破坏 |
| 8 | 查看第 2 条“用户信息”记录 | 中文名保留为 `用户信息`，字段名保持空白待人工补录；页面不会自动带出 `user_info`、`user_info_`、`userinfo` 等由分词拼接得到的字段名 |
| 9 | 打开浏览器开发者工具 Network，重新点击一次【解析】，检查 `POST /dmetadata/v1/dataWarehouseTable/nameParseColumn` 的返回值 | 返回结果中，“客户编号”对应记录包含 `columnName = "cust_id"`；“用户信息”对应记录仅保留 `columnNameCn = "用户信息"`，不会出现由 `用户`、`信息` 两个词根拼接出的 `columnName` |
| 10 | 为第 2 条记录手工补充一个合法字段名（如 `user_info_manual`），执行一次【临时保存】或继续后续建表操作 | 页面仍可正常流转，说明 Hotfix 只收敛了错误的自动翻译逻辑，没有引入新的前端交互阻塞 |
