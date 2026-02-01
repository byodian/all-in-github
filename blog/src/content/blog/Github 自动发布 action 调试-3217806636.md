---
tags:
  - Github action
  - test
categories:
  - Note
  - Log
title: Github 自动发布 action 调试
slug: "3217806636"
author: byodian
pubDatetime: 2025-08-24T05:19:04Z
modDatetime: 2026-02-01T13:29:53Z
description: ""
---




Github 自动部署 action 脚本调试

Github 提供的 GITHUB\_TOKEN 无法触发下一个 workflow，为了防止无限循环。

[https://docs.github.com/en/actions/tutorials/authenticate-with-github\_token](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

![Image](https://github.com/user-attachments/assets/56a21d21-b850-4037-a68e-88a0ff6ed351)![image.png](https://issuedesk.noteverso.com/images/1769939466557-4e71b636.png "image.png")

测试