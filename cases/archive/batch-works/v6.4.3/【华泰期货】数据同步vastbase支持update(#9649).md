---
suite_name: "【华泰期货】数据同步vastbase支持update(#9649)（XMind）"
description: "【华泰期货】数据同步vastbase支持update(#9649)（XMind）"
prd_id: 9649
prd_version: v6.4.3
prd_path: ""
product: batch-works
tags:
  - 离线开发
  - 周期任务
  - 手动任务
  - 华泰期货
  - 数据同步vastbase支持update
create_at: 2026-03-29
status: ""
health_warnings: []
case_count: 16
origin: xmind
---
## 周期任务

##### 【P0】验证数据来源为inceptor、mysql、oracle数据源，vastbase作为目标端时，主键冲突支持可选update

> 前置条件
```
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源分别选择inceptor/mysql/oracle<br>schema<br>表名：test_zhouqi_001<br>点击下一步 | 进入选择目标界面 |
| 3 | 点击主键冲突下拉框 | 展示on duplicate key update可选 |

##### 【P0】验证数据来源为inceptor数据源，vastbase作为目标端时，主键冲突选择on duplicate key update任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
inceptor建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT,
    name VARCHAR(255),
    PRIMARY KEY(id)
)
STORED AS ORC
TBLPROPERTIES (
    'transactional' = 'true'
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'Bob');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源inceptor<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入 |

##### 【P0】验证数据来源为mysql数据源，vastbase作为目标端时，主键冲突选择on duplicate key update任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'keke');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源mysql<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入 |

##### 【P0】验证数据来源为oracle数据源，vastbase作为目标端时，主键冲突选择on duplicate key update任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
oracle建表语句：
CREATE TABLE test_table (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'hello');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源oracle<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入 |

##### 【P1】周期运行——验证上述数据同步任务周期运行正常

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'keke');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 上述任务提交至运维中心 | 任务提交成功 |
| 2 | 进入运维中心-周期任务管理，选择上述任务点击补数据 | 任务补数据运行成功 |

##### 【P1】验证数据来源为spark数据源，vastbase作为目标端时，主键冲突无法选择 update

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
inceptor建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT,
    name VARCHAR(255),
    PRIMARY KEY(id)
)
STORED AS ORC
TBLPROPERTIES (
    'transactional' = 'true'
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'Bob');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源选择spark<br>表名：test_zhouqi_001<br>点击下一步 | 进入选择目标界面 |
| 3 | 点击主键冲突下拉框 | 不展示on duplicate key update选项 |

##### 【P1】验证数据来源为mysql数据源，vastbase作为目标端时，主键冲突选择insert任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'keke');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源mysql<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择insert<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 勾选脏数据管理<br>脏数据表：dirty_01<br>点击下一步，点击保存，点击运行 | 任务运行失败，报错脏数据 |
| 6 | select查询vastbase数据表结果 | 表数据未改变，数据没有插入 |
| 7 | 进入运维中心查看脏数据表内容 | 展示脏数据：1, 'Alice' |

##### 【P1】验证未映射字段保持不变

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    bir VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice','mengfei');
INSERT INTO test_table VALUES (2, 'Bob','kako');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    bir VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu','mengfei_chongtu');
INSERT INTO test_table VALUES (3, 'keke','kako_chongtu');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源mysql<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置字段映射，name字段不进行映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入，未映射的字段数据不做更改，结果应当是：<br>1, 'Alice','mengfei_chogntu'<br>2, 'Bob','kako'<br>3, 'keke','kako_chongtu' |

## 手动任务

##### 【P0】验证数据来源为inceptor、mysql、oracle数据源，vastbase作为目标端时，主键冲突支持可选on duplicate key update

> 前置条件
```
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源分别选择inceptor/mysql/oracle<br>schema<br>表名：test_zhouqi_001<br>点击下一步 | 进入选择目标界面 |
| 3 | 点击主键冲突下拉框 | 展示on duplicate key update可选 |

##### 【P0】验证数据来源为inceptor数据源，vastbase作为目标端时，主键冲突选择on duplicate key update任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
inceptor建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT,
    name VARCHAR(255),
    PRIMARY KEY(id)
)
STORED AS ORC
TBLPROPERTIES (
    'transactional' = 'true'
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'Bob');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源inceptor<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入 |

##### 【P0】验证数据来源为mysql数据源，vastbase作为目标端时，主键冲突选择on duplicate key update任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'keke');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源mysql<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入 |

##### 【P0】验证数据来源为oracle数据源，vastbase作为目标端时，主键冲突选择on duplicate key update任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
oracle建表语句：
CREATE TABLE test_table (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'hello');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源oracle<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入 |

##### 【P1】手动任务运行——验证上述数据同步任务运维中心手动运行正常

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'keke');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 上述任务提交至运维中心 | 任务提交成功 |
| 2 | 进入运维中心-手动任务管理，选择上述任务点击运行 | 任务运行成功 |

##### 【P1】验证数据来源为spark数据源，vastbase作为目标端时，主键冲突无法选择on duplicate key update

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
inceptor建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT,
    name VARCHAR(255),
    PRIMARY KEY(id)
)
STORED AS ORC
TBLPROPERTIES (
    'transactional' = 'true'
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'Bob');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源选择spark<br>表名：test_zhouqi_001<br>点击下一步 | 进入选择目标界面 |
| 3 | 点击主键冲突下拉框 | 不展示on duplicate key update选项 |

##### 【P1】验证数据来源为mysql数据源，vastbase作为目标端时，主键冲突选择insert任务正常运行

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice');
INSERT INTO test_table VALUES (2, 'Bob');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu');
INSERT INTO test_table VALUES (3, 'keke');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源mysql<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择insert<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置同字段映射，点击下一步 | 进入通道控制页面 |
| 5 | 勾选脏数据管理<br>脏数据表：dirty_01<br>点击下一步，点击保存，点击运行 | 任务运行失败，报错脏数据 |
| 6 | select查询vastbase数据表结果 | 表数据未改变，数据没有插入 |
| 7 | 进入运维中心查看脏数据表内容 | 展示脏数据：1, 'Alice' |

##### 【P1】验证未映射字段保持不变

> 前置条件
```
vastbase建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    bir VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice','mengfei');
INSERT INTO test_table VALUES (2, 'Bob','kako');
SELECT * FROM test_table;
mysql建表语句：
DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    bir VARCHAR(255)
);
INSERT INTO test_table VALUES (1, 'Alice_chongtu','mengfei_chongtu');
INSERT INTO test_table VALUES (3, 'keke','kako_chongtu');
```

> 用例步骤

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| 1 | 进入【数据开发模块】页面，新建向导模式的数据同步任务 | 新建成功 |
| 2 | 选择数据来源mysql<br>schema<br>表名：前置表<br>点击下一步 | 进入选择目标界面 |
| 3 | 选择数据目标vastbase<br>schema<br>表名：前置表<br>主键冲突选择on duplicate key update<br>点击下一步 | 进入选择字段映射界面 |
| 4 | 配置字段映射，name字段不进行映射，点击下一步 | 进入通道控制页面 |
| 5 | 点击下一步，点击保存，点击运行 | 任务保存、运行成功 |
| 6 | select查询vastbase数据表结果 | 对应主键冲突的数据被update，未冲突的数据正常插入，未映射的字段数据不做更改，结果应当是：<br>1, 'Alice','mengfei_chogntu'<br>2, 'Bob','kako'<br>3, 'keke','kako_chongtu' |