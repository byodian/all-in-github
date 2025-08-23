---
tags:
  - Java
  - Mybatis-Plus
  - ORM
categories:
  - Note
  - Log
title: Mybatis-Plus 配置选项 mapunderscoretocamelcase
slug: "1911768719"
author: byodian
pubDatetime: 2024-01-26T09:51:38Z
modDatetime: 2025-08-18T13:39:32Z
description: ""
---



Mybaits-plus 默认开启 `mapunderscoretocamelcase` 驼峰命名规则映射，它会将 SQL 查询结果中以下划线命名的数据库字段（比如 `A_COLUMN`）映射为以驼峰命名的 Java 类字段（比如 `aColumn`）。

> [!WARNING]  
> 如果此时将 Java 类字段定义为小写下划线规则，比如 `a_column`，那么这个Java 类字段就接受不到 Mybatis 查询的结果。比如：

```java
@Data
public SomeResponse {
    private String n_alms;
    private String c_alms;
    private String b_alms;
}
```

```xml
<select id="getAlarmCountToday" resultType="com.example.demo.device.model.SomeResponse">
    SELECT
        SUM(IF(DATE(alarm_time) = CURRENT_DATE AND alarm_type = 'c_alms', 1, 0)) AS c_alms,
        SUM(IF(DATE(alarm_time) = CURRENT_DATE AND alarm_type = 'b_alms', 1, 0)) AS b_alms,
        SUM(IF(DATE(alarm_time) = CURRENT_DATE AND alarm_type = 'n_alms', 1, 0)) AS n_alms
    FROM device_alarm_record
    WHERE tenant_id = #{tenantId}
</select>
```

[mapunderscoretocamelcase](https://baomidou.com/en/reference/#mapunderscoretocamelcase)