# tReader

又一个 TXT 文本阅读器。

自用为主。

## 使用

https://tiansh.github.io/reader

Safari 打开，选择“添加到主屏幕”，从主屏幕上找到并打开，就可以开始用了。

Android 设备的话可能需要 Chrome 浏览器打开。作者没试过。

### 文件列表

* 点左上角的添加按钮可以添加文件：
    * 文件可以从本机、iCloud 或者 OneDrive、MEGA 之类的地方选择。
    * 如果文件打开乱码，请考虑使用 UTF-8 保存文件。
* 点右上角可以进入设置。
* 文件列表点击打开文件进入阅读界面。
* 文件列表，左滑可以显示删除按钮，删除对应的文件。
* 键盘操作下，可以按 <kbd>Delete</kbd> 键两次删除文件。

### 设置

* 主题的自动模式会跟随系统设置，兼容系统设置的定时暗色模式等。
* 字体设置可以载入字体文件，支持的文件类型受限于使用的浏览器。Safari 支持 \*.ttf 格式的字体。*
* 语言标记用于标记文章的语言。设置后浏览器会自动为 CJK 兼容字符选择你设置的语言对应的字体。
    * 如果需要设置为简体中文，可以填写 `zh-Hans`。
* 预处理操作只会在文件导入时执行一次，设置后可能需要重新添加文件。
* 朗读中可以选择的语音是系统中安装的语音：
    * 目前 Safari 选择语音有 bug，几个 `zh-CN` 语言的语音没有区别。
    * 不建议使用任何标记为“远程”的语音，否则可能会感受到大量卡顿。

### 阅读

* 阅读界面的基本操作
    * 左滑，点右侧：下一页
    * 右滑，点左侧：上一页
    * 上滑，点中间：显示菜单
    * 下滑：显示目录，书签或搜索
* 目录：
    * 点右上角的刷新图标可以生成或刷新目录，会要求输入目录的模板。
    * 如果书中每个章节的标题采用“第三章　章节标题”这样的格式，那么目录模板就填写“第\*章 ”。
    * 用“/”开头和结尾的话可以写正则表达式。
* 书签：
    * 点右上角那个可以添加书签。
    * 左滑已添加的书签可以出现删除按钮。
* 搜索：
    * 搜索时每行只匹配第一个结果，所以如果一行里面出现多次也只会匹配出来第一次。

Android 的话作者没试过，有问题欢迎 PR。计算机上、以及 iOS Safari 上不能复现的问题，作者可能没法处理。

## 开发

直接使用任意的静态 HTTP 服务器服务 src 目录即可。无需编译。

因为使用了 Service Worker 作为离线存储，你的修改可能无法实时在浏览器中得到体现。为此，你可以调整浏览器设置，或从 `main.js` 中临时注释掉相关的代码以方便调试。

更改配色可以参考 `light.css`, `dark.css` 文件。更改阅读界面的样式可以参考 `readpage.css`。

## Open Source Credit

* normalize.css: from normalize v8.0.1
    * MIT License; https://github.com/necolas/normalize.css
* icon.svg / icon.woff based on Feather
    * MIT License; https://github.com/feathericons/feather
* s2t.json, t2s.json Chinese traditional / simplified translation tables based on OpenCC
    * Apache License 2.0; https://github.com/BYVoid/OpenCC
    * For more details about the modification, see https://github.com/tiansh/opencc-fsm

## About

Copyright (C) 2020 田生

This project is released under the Mozilla Public License 2.0 with no copyleft exception. You may checkout LICENSE file for more detail.
