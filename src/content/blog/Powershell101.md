---
tags:
  - powershell
  - Published
  - Blog
title: Powershell101
slug: "1581067225"
author: byodian
pubDatetime: 2022-03-18T03:36:42Z
modDatetime: 2024-01-21T09:51:58Z
featured: false
description: ""
---

## 探索 Powershell

- `Get-Verb` Returns a list of verbs that most commands adhere to.
- `Get-command` retrieves a list of all commands installed on your machine.
- `Get-Member` operates on object based output and is able to discover what object, properties and methods are available for a command.
- `Get-Help` displays a help page describing various parts of a command.

## 配置 [powershell](https://docs.microsoft.com/en-us/powershell/scripting/learn/tutorials/01-discover-powershell?view=powershell-7.2)

1. 安装 [powershell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.2)
2. 配置 [windows terminal](https://docs.microsoft.com/en-us/windows/terminal/)
3. 安装 [scoop](https://scoop.sh/) - A command-line installer for Windows
4. 安装 [Winget](https://docs.microsoft.com/en-us/windows/package-manager/winget/)  - I****nstall and manage applications****
5. 安装  [git for windows](https://gitforwindows.org/) - Offer a lightweight, native set of tools
    
    ```powershell
    winget install -e --id Git.Git
    ```
    
6. 安装 `gcc` 、 `neovim`
    
    ```powershell
    scoop install gcc neovim
    ```
    
7. *powershell 配置文件 - [about _profiles](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles?view=powershell-7.2)*
    
    ****The $PROFILE variable****
    
    The `$profile` automatic variable stores the paths to the Powershell profiles that are available in the current session.
    
    The `$PROFILE` variable stores the path to the "**Current User, Current Host**" profile. The other profiles are saved in note properties of the `$PROFILE` variable.
    
    [$profile](https://www.notion.so/6a5a454c6e4a44afb56fb4d72bb9b224)
    
    ```powershell
    
    Split-Path $PROFILE.CurrentUserCurrentHOST
    
    mkdir ~/.config/powershell
    nvim ~/.config/powershell/user_profile.ps1
    ```
    
    创建 `$PROFILE.CurrentUserCurrentHost` 文件 ，并添加 `. $env:USEPROFILE\.config\powershell\user_profile.ps1` 内容，重新启动终端，这时配置文件已生效。
    
    ```powershell
    # Create a profile
    New-Item $PROFILE.CurrentUserCurrentHost
    
    # or 
    nvim $PROFILE
    ```
    
8. 安装 `posh-git` 和 `oh-my-posh`
    - **Prompt for Git repositories**
    - A prompt theme engine for any shell
    
    ```powershell
    Install-Module posh-git -Scope CurrentUser -Force
    Install-Module oh-my-posh -Scope CurrentUser -Force
    ```
    
    编辑 `~/.config/powershell/user-profile.ps1`
    
    ```powershell
    # Prompt
    Import-Module posh-git
    Import-Module oh-my-posh
    Set-PoshPrompt <themename>
    ```
    
9. 自定义 prompt
10. 安装 nvm
    
    ```powershell
    scoop install nvm
    ```
    
11. 安装 [terminal icons](https://github.com/devblackops/Terminal-Icons)
    
    ```powershell
    # Install-Module
    Install-Module -Name Terminal-Icons -Repository PSGallery -Force
    
    # or use scoop
    scoop bucket add extras
    scoop install terminal-icons
    
    Import-Module Terminal-Icons
    ```
    
12. 安装 z
    
    ```powershell
    Install-Module -Name z -Force 
    ```
    
13. 安装 [PSReadLine](https://github.com/PowerShell/PSReadLine) - autocompletion 
    
    [How to use PSReadLine](https://docs.microsoft.com/en-us/powershell/module/psreadline/?view=powershell-7.2)
    
    ```powershell
    Install-Module -Name PowerShellGet -Force
    Install-Module -Name PSReadLine -Force -SkipPublisherCheck -AllowPrerelease
    ```
    
    To start using, just import the module:
    
    `Import-Module PSReadLine`
    
    To view the current key bindings:
    
    `Get-PSReadLineKeyHandler`
    
    To use Emacs key bindings, you can use:
    
    `Set-PSReadLineOption -EditMode Emacs`
    
    Specifies the source for PSReadLine to get predictive suggestions.
    
    `Set-PSReadLineOption -PredictionSource Hisory`
    
    Sets the style for the display of the predictive text. The default is **InlineView**.
    
    `Set-PSReadLineOption -PredictionViewStyle ListView`
    
    ```powershell
    # user_profile.ps1
    Import-Module PSReadLine
    Set-PSReadLineOption -EditMode Emacs
    Set-PSReadLineOption -PredictionSource HisoryAndPlugin
    Set-PSReadLineOption -PredictionViewStyle ListView
    ```
    
14. 安装 `fzf` [PSFzf](https://github.com/kelleyma49/PSFzf)
    
    ```powershell
    scoop install fzf
    Install-Module -Name PSFzf -Scope CurrentUser -Force
    ```
    

## about_Environment_Provider

The environment Environment provider lets you get, add, change, clear, delete environment variables and values in Powershell.

Windows and Powershell use Environment variables to store persistent information that affect system and process execution.

Unlike PowerShell variables, environment variables are not subject to scope constraints.

The Environment provider supports the following cmdlets.

- [Get-Location](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-location?view=powershell-7.2)
- [Set-Location](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/set-location?view=powershell-7.2)
- [Get-Item](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-item?view=powershell-7.2)
- [New-Item](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/new-item?view=powershell-7.2)
- [Remove-Item](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/remove-item?view=powershell-7.2)
- [Clear-Item](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/clear-item?view=powershell-7.2)

## ****[about_Environment_Variables](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.2)****

Environment variables store information about the operating system environment. 

The environment variables store data that is used by the operating system and other programs.

## ****[about_CommonParameters](https://docs.microsoft.com/zh-cn/powershell/module/microsoft.powershell.core/about/about_commonparameters?view=powershell-7.2)****

描述可与任何 cmdlet 一起使用的参数。****

## 常见问题

### Windows terminal 下 git bash 乱码问题

在相应的 git-for-windows 的安装路径文件 `**\Git\etc\bash.bashrc` 末尾添加

```bash
# 让ls和dir命令显示中文和颜色 
alias ls='ls --show-control-chars --color' 
alias dir='dir -N --color' 
# 设置为中文环境，使提示成为中文 
export LANG="zh_CN" 
# 输出为中文编码 
export OUTPUT_CHARSET="utf-8"

# 可以输入中文 
set meta-flag on 
set output-meta on 
set convert-meta off
```

## 命令

- 生成唯一标识 guid `[guid]::NewGuid()`
- 设置代理
    
    ```powershell
    # powershell
    $env:HTTP_PROXY="http://127.0.0.1:1080"
    $env:HTTPS_PROXY="http://127.0.0.1:1080"
    
    # cmd
    set http_proxy=http://127.0.0.1:1080
    ```
    

## 技巧

1. 按tab 键可自动补全命令
2. Reset your video devicer: `Ctrl+shift+win+B`

## 资源

[https://www.powershellgallery.com/packages/PSFzf/2.0.0](https://www.powershellgallery.com/packages/PSFzf/2.0.0)

[https://www.powershellgallery.com/](https://www.powershellgallery.com/)
test