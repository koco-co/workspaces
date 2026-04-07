# CI 数据源连接信息

> 来源项目：`dt-insight-qa/dtstack-httprunner`
> 文件路径：`config/datasourceconfig/` & `config/env/`

---

## 一、CI 环境配置（config/env/）

### 1. CI 52 环境（ci_52_insightci.ini）

| 配置项 | 值 |
|---|---|
| UIC 地址 | `http://172.16.101.201:82` |
| RDOS 地址 | `http://172.16.101.201` |
| 登录用户名 | `admin@dtstack.com` |
| 登录密码 | `DrpEco_2020` |
| 租户名 | `DT_demo` |
| DB Host | `172.16.82.219` |
| DB 用户名 | `drpeco` |
| DB 密码 | `DT@Stack#123` |
| 数据源自动化服务 | `http://172.16.101.151:7666` |

### 2. CI 62 环境（ci_62_insightci.ini）

| 配置项 | 值 |
|---|---|
| UIC 地址 | `http://172.16.115.247:82` |
| RDOS 地址 | `http://172.16.115.247` |
| 登录用户名 | `admin@dtstack.com` |
| 登录密码 | `DrpEco_2020` |
| 租户名 | `hadoop2` |
| DB 类型 | `MYSQL` |
| DB Host | `172.16.115.247` |
| DB 用户名 | `drpeco` |
| DB 密码 | `DT@Stack#123` |
| 数据源自动化服务 | `http://172.16.101.151:7666` |

### 3. CI 63 环境（ci_63_insightci.ini）

| 配置项 | 值 |
|---|---|
| UIC 地址 | `http://172.16.122.52:82` |
| RDOS 地址 | `http://172.16.122.52` |
| 登录用户名 | `admin@dtstack.com` |
| 登录密码 | `DrpEco_2020` |
| 租户名 | `hadoop2` |
| DB 类型 | `MYSQL` |
| DB Host | `172.16.122.49` |
| DB 用户名 | `drpeco` |
| DB 密码 | `DT@Stack#123` |
| 数据源自动化服务 | `http://172.16.101.151:7666` |

### 4. DM For MySQL 环境（dm_for_mysql_env.ini）

| 配置项 | 值 |
|---|---|
| UIC 地址 | `http://172.16.124.110` |
| RDOS 地址 | `http://172.16.124.110` |
| 登录用户名 | `admin@dtstack.com` |
| 登录密码 | `DrpEco_2020` |
| 租户名 | `hadoop2` |
| DB 类型 | `DM_FOR_MYSQL` |
| DB Host | `172.16.124.111` |
| DB Port | `5236` |
| DB 用户名 | `drpeco` |
| DB 密码 | `DT@Stack#123` |

### 5. DM For Oracle 环境（dm_for_oracle_env.ini）

| 配置项 | 值 |
|---|---|
| UIC 地址 | `http://172.16.124.210` |
| RDOS 地址 | `http://172.16.124.210` |
| 登录用户名 | `admin@dtstack.com` |
| 登录密码 | `DrpEco_2020` |
| 租户名 | `DT_demo` |
| DB 类型 | `DM_FOR_ORACLE` |
| DB Host | `172.16.124.209` |
| DB Port | `5236` |
| DB 用户名 | `drpeco` |
| DB 密码 | `DT@Stack#123` |

### 6. 63 批量测试环境（test_63_batch.ini）

| 配置项 | 值 |
|---|---|
| UIC 地址 | `http://shuzhan63-online-test.k8s.dtstack.cn` |
| 登录用户名 | `admin@dtstack.com` |
| 登录密码 | `DrpEco_2020` |
| DB 类型 | `MYSQL` |
| DB Host | `172.16.124.147` |
| DB Port | `32115` |
| DB 用户名 | `root` |
| DB 密码 | `DT@Stack#123` |
| 数据源自动化服务 | `http://172.16.101.151:7666` |

---

## 二、数据源连接配置（config/datasourceconfig/）

### MySQL（mysql.py）

| 变量名 | Host | Port | 用户名 | 密码 | 说明 |
|---|---|---|---|---|---|
| `MySQL` | `172.16.124.43` | `30307` | `drpeco` | `DT@Stack#123` | MySQL 8.0.39，默认配置 |
| `MySQL_stream` | `172.16.101.50` | `3306` | `drpeco` | `DT@Stack#123` | MySQL 5.7.32 单机模式 |
| `MySQL_8` | `172.16.23.194` | `3306` | `root` | `Password!.` | MySQL 8 |

JDBC URL 示例：
- `MySQL`：`jdbc:mysql://172.16.124.43:30307`
- `MySQL_stream`：`jdbc:mysql://172.16.101.50:3306`
- `MySQL_8`：`jdbc:mysql://172.16.23.194:3306`

### Oracle（oracle.py）

| 变量名 | Host | Port | 用户名 | 密码 | Service Name / SID | 说明 |
|---|---|---|---|---|---|---|
| `Oracle` | `172.16.124.43` | `31521` | `drpeco` | `oracle` | `ORCLPDB` / `orcl` | Oracle 11.2.0，默认配置 |

JDBC URL：`jdbc:oracle:thin:@172.16.124.43:31521/ORCLPDB`

### PostgreSQL（postgresql.py）

| 变量名 | Host | Port | 用户名 | 密码 | DB | 说明 |
|---|---|---|---|---|---|---|
| `postgresql` | `172.16.124.43` | `32432` | `postgres` | `DT#passw0rd2019` | `postgres` | 默认配置 |
| `postgresql_wal` | `172.16.124.43` | `32432` | `postgres` | `DT#passw0rd2019` | `postgres` | WAL 模式 |

JDBC URL：`jdbc:postgresql://172.16.124.43:32432/postgres`

### ADB for PostgreSQL（adb_for_pg.py）

| 变量名 | Host | Port | 用户名 | 密码 | DB |
|---|---|---|---|---|---|
| `adb_for_pg` | `172.16.124.43` | `32432` | `postgres` | `DT#passw0rd2019` | `postgres` |

JDBC URL：`jdbc:postgresql://172.16.124.43:32432/postgres`

### Greenplum（greenplum.py）

| 变量名 | Host | Port | 用户名 | 密码 | DB | 版本 |
|---|---|---|---|---|---|---|
| `greenplum` | `172.16.100.243` | `5432` | `gpadmin` | `gpadmin` | `postgres` | 6.9.1 |

JDBC URL：`jdbc:pivotal:greenplum://172.16.100.243:5432;DatabaseName=postgres`

### Hive（hive.py）

| 变量名 | Host | Port | 用户名 | 密码 | defaultFS | 说明 |
|---|---|---|---|---|---|---|
| `Hive` | `172.16.21.253` | `10004` | _(空)_ | _(空)_ | `hdfs://ns1` | Hive 2.1.0，默认配置 |
| `hive1_info` | `172.16.100.244` | `10000` | _(空)_ | _(空)_ | `hdfs://172.16.100.244:9000` | — |
| `hive_kerberos` | `master` | `10000` | — | — | `hdfs://master:8020` | CDH Kerberos |
| `hive3_CDP` | `172.16.83.246` | `10000` | — | — | `hdfs://cdp7-scm-node1:8020` | CDP 7 Kerberos |

HA 节点（`Hive` 默认配置）：
- nn1：`172.16.20.255:9000`
- nn2：`172.16.21.253:9000`

### Kafka（kafka.py）

| 变量名 | ZooKeeper 地址 | Bootstrap Servers | 说明 |
|---|---|---|---|
| `Kafka` | `172.16.83.73:2181,172.16.83.214:2181,172.16.83.225:2181/kafka` | `172.16.23.243:9092` | Kafka 0.11，默认配置 |
| `Kafka_2_x` | 同上 | `172.16.23.243:9092` | Kafka 2.x |
| `Kafka_010` | 同上 | `172.16.23.243:9092` | Kafka 0.10 |
| `Kafka_Kerberos` | — | `172.16.101.169:9092` | CDH Kerberos |

### Elasticsearch（elasticsearch.py）

| 变量名 | IP | Port |
|---|---|---|
| `es6` | `172.16.100.186` | `9200` |
| `es7` | `172.16.100.243` | `9200` |

### HBase（hbase.py）

| 变量名 | ZooKeeper Quorum | Kerberos | 说明 |
|---|---|---|---|
| `hbase1x` | `172.16.83.84:2181,172.16.83.101:2181,172.16.83.201:2181` | 否 | HBase 1.x |
| `hbase2x` | `172.16.101.95,172.16.100.32,172.16.101.137:2181` | 否 | HBase 2.x |
| `hbase_kerberos` | `master:2181` | 是（CDH） | CDH Kerberos，需域名 |

### HDFS（hdfs.py）

| 配置项 | 值 |
|---|---|
| HDFS Host | `http://172.16.20.255:60070` |
| defaultFS | `hdfs://ns1` |
| nn1 | `172.16.20.255:9000` |
| nn2 | `172.16.21.253:9000` |

### SparkThrift（sparkthrift.py）

| 配置项 | 值 |
|---|---|
| JDBC URL | `jdbc:hive2://172.16.20.255:10000` |
| 用户名 | `admin` |
| defaultFS | `hdfs://ns1` |
| nn1 | `172.16.20.255:9000` |
| nn2 | `172.16.21.253:9000` |

### Doris（doris.py）

| 变量名 | Host | Port | 用户名 | 密码 | 说明 |
|---|---|---|---|---|---|
| `Doris` | `172.16.83.193` | `9031` | `root` | _(空)_ | Doris 0.14.x (HTTP)，Fe Nodes: `172.16.83.193:8030` |
| `Doris2x` | `172.16.124.72` | `19030` | `root` | _(空)_ | Doris 2.x，Fe Nodes: `172.16.124.72:18030` |

JDBC URL（Doris2x）：`jdbc:mysql://172.16.124.72:19030/automation`

### StarRocks（starrocks.py）

| 变量名 | Host | Port | 用户名 | 密码 | 说明 |
|---|---|---|---|---|---|
| `STARROCKS2X` | `172.16.82.221` | `9030` | `root` | _(空)_ | StarRocks 2.x（节点：.221/.151/.68） |
| `STARROCKS3X` | `172.16.112.99` | `19030` | `root` | _(空)_ | StarRocks 3.x，Fe: `172.16.112.99:18030` |

### Trino（trino.py）

| 配置项 | 值 |
|---|---|
| Host | `172.16.21.107` |
| Port | `8081` |
| 用户名 | `root` |
| 密码 | _(空)_ |
| Catalog | `hive_ci` |
| Schema | `api_auto_test` |
| JDBC URL | `jdbc:trino://172.16.21.107:8081/hive_255/api_auto_test` |

### DMDB（dmdb.py）

| 变量名 | JDBC URL | 用户名 | 密码 | 说明 |
|---|---|---|---|---|
| `dmdb_for_mysql_info` | `jdbc:dm://172.16.124.43:30001` | `SYSDBA` | `SYSDBA_dm001` | DMDB For MySQL，默认配置 |
| `dmdb_for_oracle_info` | `jdbc:dm://172.16.124.43:30002` | `SYSDBA` | `SYSDBA_dm001` | DMDB For Oracle，默认配置 |

### SFTP（sftp.py）

| 变量名 | Host | Port | 用户名 | 密码 | 说明 |
|---|---|---|---|---|---|
| `FTP` | `172.16.23.170` | `22` | `dtstack` | `abc123` | SFTP |
| `FTP_PRO` | `172.16.82.161` | `22` | `mushan` | `DT@Stack#123` | 商业版 FTP |

---

## 三、依赖包（requirements.txt）

### 数据库 / 数据源驱动

| 包名 | 版本 | 用途 |
|---|---|---|
| `cx-Oracle` | `8.1.0` | Oracle 连接 |
| `psycopg2-binary` | `2.8.6` | PostgreSQL 连接 |
| `PyMySQL` | `1.0.2` | MySQL 连接 |
| `pymssql` | `2.1.5` | SQL Server 连接 |
| `python-tds` | `~1.11.0` | SQL Server TDS 协议 |
| `PyHive` | `0.6.3` | Hive 连接 |
| `thrift` | `0.11.0` | Hive/Thrift 协议 |
| `thrift-sasl` | `0.4.3` | Hive SASL 认证 |
| `sasl` | `0.2.1` | SASL 认证 |
| `trino` | `0.320.0` | Trino 连接 |
| `sqlalchemy-trino` | `0.5.0` | Trino SQLAlchemy 方言 |
| `SQLAlchemy` | `1.4.7` | ORM / SQL 工具 |
| `jaydebeapi` | `1.2.3` | JDBC 桥接（DMDB 等） |
| `pyhdb` | `0.3.4` | SAP HANA 连接 |
| `pysolr` | `3.9.0` | Solr 连接 |
| `influxdb` | `5.3.1` | InfluxDB 1.x 连接 |
| `influxdb-client` | `1.38.0` | InfluxDB 2.x 连接 |
| `elasticsearch` | `7.12.0` | Elasticsearch 连接 |

### Hadoop 生态

| 包名 | 版本 | 用途 |
|---|---|---|
| `hdfs` | `2.6.0` | HDFS 客户端 |
| `PyHDFS` | `~0.3.1` | HDFS Python 客户端 |
| `happybase` | `1.2.0` | HBase 连接 |
| `hbase-python` | `0.5` | HBase 连接 |
| `kazoo` | `2.8.0` | ZooKeeper 客户端 |
| `kafka-python` | `2.0.2` | Kafka 客户端 |
| `protobuf` | `3.15.8` | Protocol Buffers |

### SSH / SFTP

| 包名 | 版本 | 用途 |
|---|---|---|
| `paramiko` | `~2.7.2` | SSH / SFTP 客户端 |

### 测试框架

| 包名 | 版本 | 用途 |
|---|---|---|
| `httprunner` | `3.1.4` | HTTP 接口测试框架 |
| `pytest` | `~5.4.3` | 测试框架 |
| `pytest-xdist` | `1.30.0` | 并行测试 |
| `pytest-parallel` | `0.1.1` | 并行测试 |
| `pytest-ordering` | `0.6` | 测试排序 |
| `pytest-rerunfailures` | `~10.1` | 失败重试 |
| `pytest-assume` | `2.4.3` | 多断言 |
| `pytest-instafail` | `0.4.2` | 即时失败报告 |
| `pytest-json-report` | `1.3.0` | JSON 报告 |
| `pytest-metadata` | `2.0.4` | 元数据 |
| `allure-pytest` | `2.8.40` | Allure 报告 |
| `allure_python_commons` | `2.8.40` | Allure 公共库 |

### 工具类

| 包名 | 版本 | 用途 |
|---|---|---|
| `requests` | `~2.25.0` | HTTP 请求 |
| `requests-toolbelt` | `0.9.1` | requests 工具集 |
| `pydantic` | `~1.7.2` | 数据验证 |
| `PyYAML` | `5.4.1` | YAML 解析 |
| `jsonpath` | `0.82` | JSONPath 查询 |
| `jsonpath_ng` | `1.5.3` | JSONPath 查询增强 |
| `jsonschema` | `~3.2.0` | JSON Schema 验证 |
| `python-dotenv` | `~0.15.0` | .env 文件加载 |
| `Faker` | `~8.11.0` | 测试数据生成 |
| `pycryptodome` | `3.10.1` | 加解密 |
| `polling2` | `0.5.0` | 轮询工具 |
| `pandas` | `2.0.2` | 数据处理 |
| `openpyxl` | `3.1.5` | Excel 读写 |
| `filetype` | `1.0.7` | 文件类型检测 |
| `pyzmq` | `22.2.1` | ZeroMQ 消息队列 |
| `sqlparse` | `0.5.3` | SQL 解析 |
| `radar` | `0.3` | 随机日期生成 |
| `fake` | `0.8` | 假数据生成 |
| `pluggy` | `0.13.1` | 插件管理 |
| `attrs` | `22.1.0` | 类属性工具 |
| `wheel` | `0.37.1` | 打包工具 |
| `setuptools` | `57.0.0` | 打包工具 |
