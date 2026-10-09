---
tags:
  - shell
title: shell101
slug: "1581067416"
author: byodian
pubDatetime: 2022-03-18T02:59:42Z
modDatetime: 2024-01-25T15:22:12Z
featured: false
description: ""
---

Shell 脚本基础的概念是一系列命令的列表，列表中的命令按照顺序执行。结构良好的 Shell 脚本还应该有注释（使用前置符号 `#` ）描述步骤。

Shell 脚本文件扩展以 `.sh` 结尾，文件开头使用 `shebang` 构造提示系统一个 shell 脚本将要开始。

```powershell
#!/bin/bash 
```

Shell 毕竟是一门真正的编程语言，所以 Shell 脚本应该由变量、控制结构等完成。但不论 shell 脚本如何复杂，它都是一系列按照顺序执行的命令集合。

The shell is, after all, a real programming language, complete with variables, control structures, and so forth. No matter how complicated a script gets, it is still just a list of commands executed sequentially.

可以在执行命令的同时向程序传递参数：

```bash
bashuser:~$ echo hello
hello
```

**执行步骤**

1. Shell 基于空格分割命令并进行解析；
2. 执行第一个单词代表的程序，后续单词作为参数传递给程序；

也就是说，个参数中如果存在空格会被当做多个参数处理，使用以下任意一种方式可以使用带空格参数：

- 使用单引号包裹
- 使用双引号包裹
- 使用 `\` 转义

Shell 如何寻找 `date` 和 `echo` 等命令？

类似与 Python 或 Ruby，Shell 是一个编程环境，它具备变量、条件、循环或函数。

当执行命令时，实际上我们是在执行一段 shell 可以解释执行的简短代码。在 shell 中执行某条指令，它会咨询环境变量 `$PATH` ,并列出进行程序搜索的路径：

```bash
bashuser:~$ ehco $PATH
/home/bashuser/.local/bin:/home/bashuser/.nvm/versions/node/v12.18.4/bin
bashuser:~$ which echo
/usr/bin/echo
bashuser:~$ /bin/echo hello
hello
```

在 `$PATH` 中搜索由: 所分割的一系列目录，基于名字搜索该程序。找到就执行该程序。

确定某个指令名所代表的程序，可以使用 `which` 命令。

## 导航

shell 中的路径是一组被分割的目录，在 Linux 系统中使用 `/` 分割，Windows 中用 `\` 分割。

绝对路径以 `/` 开头，相对路径是指相对于当前工作目录的路径。

## 配置 Shell 提示符

显示各种有用的信息

## Shell 程序中的流概念

数据流重定向（redirect)，将数据传到给其他地方。在 Shell 中，程序有两个主要的流：输入流和输出流。

- standart input - STDIN：代码为 0，使用 `<` 或 `<<`
- standard output - STDOUT：代码为 1，使用 `>` (替换)或 `>>` (追加)
- standard error output - STDERR：代码为 2，使用 `2>` (替换)或 `2>>` (追加)

### 数据流重定向的作用

- 屏幕输出信息很重要，需要保存下来
- 背景执行的程序，不希望它干扰屏幕正常的输出结果
- 一些系统例行命令的执行结果，希望它可以保存下来
- 已知的错误信息，使用 2> /dev/null 丢弃
- 错误信息与正确信息分别输出

### 将 stdout 与 stderr 分别存到不同的文件夹

```bash
find /home -name .bashrc > list_right 2> list_error
```

以上两个文件的建立方式

- 该文件若不存在，系统会自动地将它建立起来
- 当这个文件存在的时候，那么系统就会将这个文件内容清空，然后再将数据写入
- 若以 > 输出到已存在的文件中，这个文件就会被覆盖掉

### dev/null 垃圾桶设备与特殊写法

如果我知道错误讯息会发生，所以要将错误讯息忽略掉而不显示或储存呢？`/dev/null` 可以吃掉任何导向这个设备的信息喔

```bash
find /home -name .bashrc 2> /dev/null
```

### 将正确与错误数据通通写入同一个文件

```bash
find /home -name .bashrc > list 2>&1 list
find /home -name .bashrc &> list
```

### standard input

`<` 将原本需要由键盘输入的数据，改由文件内容来取代

```bash
cat > catfile < ～/.bashrc 
```

`<<` 表示结束的输入字符，举例我们要用 `cat` 直接将输入的信息输出到 catfile 中，且当键盘输入 eof 时，该输入就会结束，此时与 `>` 做对比, `<` 输入需要使用快捷键 crtl + d 结束输入。

```bash
$ cat > catfile << "eof"
> This is a good idea
> Hello world
> eof
$ cat catfile
This is a good idea
Hello world
```

## 命令执行的判断依据

`;` 连续执行

`$?` (指令回传值) 与 `&&` 或 `||`

指令执行结果正确，回传一个 $? = 0

指令执行结果错误，回传一个 $? ≠ 0

命令是一个一个执行，`command1 && command2 || command3`

## 管道命令

管道命令仅能处理经由前面一个命令传来的正确信息，也就是标准输出的信息，对于标准错误并没有直接处理的能力。

`command1 | command2 | command3`

在每个管道命令后面接的第一个数据必定是命令，而这个命令必须要能够接受标准输入的数据才行，这样的命令才可以是管道命令。例如，less、head、tail、more 等都是可以接受 STDOUT，而 ls、cp、mv 则不是

## #!/bin/sh

```bash
#!/bin/sh
curl --head -=silent https://missing.csail.mit.edu
```

`#` 在 shell 中代表注释，而 `!` 具有特殊的含义。

## References

- [37 Important Linux Commands You Should Know](https://www.notion.so/37-Important-Linux-Commands-You-Should-Know-6753979efb6b42ea844b5f1144ee1d94)
- [应该知道的LINUX技巧](https://coolshell.cn/articles/8883.html?utm_source=pocket_mylist)
- [你可能不知道的SHELL](https://coolshell.cn/articles/8619.html)
- [打造高效的工作环境 – SHELL 篇](https://coolshell.cn/articles/19219.html)
- [the art of command line](https://github.com/jlevy/the-art-of-command-line)
- [missing-semester](https://missing.csail.mit.edu/2020/)
- [Linux命令行与shell脚本编程大全.第3版 by 布鲁姆，布雷斯纳汉 (z-lib.org).pdf](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/135dc64d-2a04-4795-ad68-48ffe0fa617d/Linux命令行与shell脚本编程大全.第3版_by_布鲁姆，布雷斯纳汉_(z-lib.org).pdf)
- [https://explainshell.com/](https://explainshell.com/)

## Bash

赋值语法 `foo=bar`，访问变量中存储的数值，其语法为 `$foo` 。使用空格分隔赋值语句，导致不能正常工作。在 Shell 脚本中使用空格会起到分割参数的作用。

```bash
# 此语句不能正常工作
foo = bar
```

Bash 中的字符串通过 `'` 和 `''` 分隔符来定义。但含义却不同，

- 单引号`'` 定义的字符串是原义字符串，其中的变量不会被转义。
- 双引号 `''` 定义的字符串会就变量值进行替换。

```bash
foo=bar
echo "$foo"
# 打印 bar
echo '$foo'
# 打印 $foo
```

## 参数

bash 使用了很多特殊变量表示参数、错误代码和相关变量。

- `$0` 脚本名
- `$1~$9` $1代表第1个参数，一次类推。
- `$@` 所有参数
- `$#` 参数个数
- `$?` 前一个命令到返回值
- `$$` 当前脚本进程识别码
- `!!` 上一条命令
- `$_` 上一条命令的最后一个参数
- `STDOUT` 返回输出值
- `STDERR` 返回错误及错误码

## 操作符

`&&` 和 `||`

- 同一行的多个命令可以用 `;` 分隔
- 程序 `true` 返回码永远是 `0`
- 程序 `false` 返回码永远是 `1`

## 命令替换

以变量的形式获取一个命令的输出

`$( CMD )` 执行 `CMD` 命令，输出结果会替换掉 `$( CMD )`

```bash
bashuser~$ echo "We are in $(pwd)"
We are in /home/bashuser
```

## 进程替换

`<( CMD )` 会执行 `CMD` 并将结果输出到一个临时文件中，并将 `<( CMD )` 替换成临时文件名。

返回值会通过文件而不是 STDIN。

显示文件夹 `foo` 和 `bar` 中文件的区别。

```bash
bashuser~$ diff <(ls foo) <(ls bar)
```

## 通配符

- `?`
- `*`
- `{}`

### 配置文件

Bash is the GNU shell, when the shell is started, it reads its configuration files. The most important are:

- `/etc/profile`
- `~/.bash_profile`
- `~/.bashrc`

### 文件夹加入环境变量

```bash
export PATH="$PATH:~/scripts"
```

### 执行 shell 脚本

脚本应该具有执行权限，更改文件权限使用命令：

```bash
chmod +x script_name.sh
```

```bash
# 脚本所在的文件夹没有被加入环境变量时
./script_name.sh

# 指定特殊的 shell 执行脚本
sh script_name.sh

bash script_name.sh
```

这种执行方式会建立一个 subshell。脚本中的函数、变量和 aliases 只能在此 subshell 中访问到，当 subshell 退出并且父级 shell 获取到控制权后，脚本中所有的内容都会被清空，并且忘记脚本所做的更改。

如果你不想开始一个新的 shell 而是希望这个脚本在当前 shell 中被打开，你应该使用：

```bash
source script_name.sh
```

此命令不需要脚本具有执行权限，命令可以在当前环境中被执行。这时脚本中定义的变量，在当前环境中就可以被访问到。

```bash
$ source script.sh
```

## Debugging Bash scripts

### Debugging on the entire script

执行脚本的命令中，添加 `-x` 选项将会 debug 整个脚本文件

`bash -x script_name.sh`

### Debugging on part(s) of the script

在脚本文件的某一命令行前后添加 `set -x` 和 `set +x` 即可 debug 该命令行。

```bash
set -x  # activate debugging from here

set +x  # stop debugging from here
```

### 使用 echo 命令调试脚本

## other useful Bash options

## The Bash environment

### Shell initialization files

`/etc/profile`

`/etc/bashrc`

You might also find that /etc/profile on your system only holds shell environment and program startup settings, while `/etc/bashrc` contains system-wide definitions for shell functions and aliases. The `/etc/bashrc` file might be referred to in `/etc/profile` or in individual user shell initialization files.

## Individual user configuration files

### **~/.bash_profile**

This is the preferred configuration file for configuration user environment individually. In this file, users can add extra configuration options or change default settings:

### **~/.bash_login**

~/.bash_profile 不存在时，此文件会被读取

### **~/.profile**

~/.bash_profile 和 ~/.bash_login 不存在时，此文件会被读取。

### **~/.bashrc**

现在开发环境下，不需要登陆的 shell 是比较常见的，在这种 shell

中，用户不需要提供用户名和密码。此时 bash 会读取 ~/.bashrc 配置文件。

### ~/.bash_logout

## Command line

- `lsb_release -a` 检查 linux 发行版本
- `cat /etc/shells` 查询 linux 系统中的支持的 shell 类型
- `umask`
    
    查看用户掩码，系统为了保护用户创建文件和文件夹的权限，此时系统会有一个默认的用户掩码（umask），大多数的 linux 系统的默认掩码为 022。
    
    用户掩码的作用：用户在创建文件时从文件的默认权限中减去掩码中的权限，默认权限（文件 0666，文件夹 0777）- umask

    
    创建文件的权限为：0666 - 0022 = 0644
    
    文件夹的权限为： 0777 - 0022 = 0755
    
- `umask -S` 以符号的形式查看用户掩码
    
    ```bash
    -rw-r--r-- 12 linuxize users 12.0K Apr  8 20:51 filename.txt
    |[-][-][-]-   [------] [---]
    | |  |  | |      |       |
    | |  |  | |      |       +-----------> 7. Group
    | |  |  | |      +-------------------> 6. Owner
    | |  |  | +--------------------------> 5. Alternate Access Method
    | |  |  +----------------------------> 4. Others Permissions
    | |  +-------------------------------> 3. Group Permissions
    | +----------------------------------> 2. Owner Permissions
    +------------------------------------> 1. File Type
    ```
    
    - `r` (read) = 4
    - `w` (write) - 2
    - `x` (execute) = 1
    - no permissions = 0

In case you're curious, this is how you would copy a file under WSL to your Windows clipboard:

```bash
cat report.txt | clip.exe
```