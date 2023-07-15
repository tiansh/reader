# tReader

https://tiansh.github.io/reader

又一个 TXT 文本阅读器。

自用为主。

## 使用

Safari 打开 https://tiansh.github.io/reader ，选择“添加到主屏幕”，从主屏幕上找到并打开，就可以开始用了。

具体的使用帮助请参考 https://tiansh.github.io/reader/help/zh\_cn.html 。

### 高级设置

有部分不适合放在设置中的琐碎可调整项目，放在了高级设置中。高级设置输入框接受一个 ini 格式的配置，具体格式如下。

```ini
[appearance]
; 当屏幕宽度达到如下值时，目录信息使用侧栏显示
screen_width_side_index=960
; （仅翻页模式）当屏幕宽度达到如下值时，使用两栏模式显示
screen_width_two_column=960
; （仅翻页模式）当屏幕宽度达到如下值时，即便显示了侧边栏目录，仍然使用两栏模式显示
screen_width_two_column_index=1260
; （仅滚动模式）在屏幕外预加载的文本数量，设置更大的数字以加载更多文本
scroll_buffer_factor=3
; （仅滚动模式）文本区域的最大宽度
scroll_max_text_width=800
; （仅滚动模式）自动滚动的默认速度，数字越大速度越快
scroll_speed=20.0
; 允许使用鼠标第四键第五键翻页（使用 Chrome 安装后可用）
mouse_paging=false
; 添加自定义 CSS
custom_css=

[text]
; 逐个尝试以下字符编码读取 txt 文件
; 如果遇到解析错误会自动尝试下一种字符编码
; 使用最后一种字符编码解析时，如果遇到错误会解析成豆腐字符
; 该项设置仅影响导入 txt 时的行为，对导入完成的 txt 无影响
encoding=utf-8,gbk,big5,utf-8
; 生成目录时，仅考虑长度不超过如下值的行
contents_max_length=100
; 生成目录时，如果识别到的目录条目数量超过如下限制，会拒绝生成目录
contents_size_limit=5000
; 搜索时用户输入识别方式
; 支持取值 text, wildcard, regex
search_mode=text
; 搜索时正则的标志，i 为忽略大小写
search_flags=iu

[speech]
; 语音朗读时，单条语音最多的字数
max_char_length=1000
; 语音朗读时，预先调度的语音条数
queue_size=10
; 显示媒体会话界面
media_session_enable=false
; 语音朗读忽略满足如下正则（ECMAScript）的文本行
skip_text_regex=/^\s*$/u
; 语音朗读遇到文章结尾时自动从开头重读
loop_enable=false
; 页面切换到后台时暂停朗读
pause_on_hidden=false
```

请谨慎配置高级设置功能，错误配置可能造成显示错误甚至完全无法使用。

## 开发

### 分支管理

目前 master 分支是实际部署使用的代码版本。 beta 分支是正在开发的任何功能。 gh-pages 分支用于部署 GitHub Pages。

如果你希望贡献代码，可以根据当前 beta 分支的内容，考虑在 master 或 beta 分支基础上进行修改。

### 本地调试

项目本身没有使用构建工具，或者说并没有编译的必要。检出代码后，直接在 src 目录下运行任意的 HTTP 服务器即可开始调试。利用常见的简单本地 HTTP 服务器如 [NPM 的 node-static](https://www.npmjs.com/package/node-static) 或 [Python 的 http.server](https://docs.python.org/3/library/http.server.html) 等工具服务 src 目录下的文件，即可在浏览器中打开并调试。

因为项目使用了 ServiceWorker 提供离线使用支持，在浏览器刷新网页可能会获取到 ServiceWorker 缓存的历史版本。所以调试时可以考虑禁用浏览器的 ServiceWorker 支持。

### 希望添加某某功能

因为 Web APP 的限制，以下功能 iOS 上目前没法支持：

* 旋转锁定<sup>[\[MDN\]](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation)</sup>
* 背光亮度调整
* 保持屏幕唤醒<sup>[\[Chrome\]](https://chromestatus.com/feature/4636879949398016)</sup>
* 隐藏手机顶部的信号与电量信息
* 后台播放语音朗读
* 切换应用时隐藏屏幕快照

所以如上相关的各种问题就不用再问我了。

但如果你要针对 Android 做任何上述功能，还是欢迎 PR。

### 繁简转换

项目的繁简转换规则基于 OpenCC 的词典整理而来。为了满足自己的使用，有一些自己的修改。

* 繁简转换包含单字转换和词转换两个词典；
* 此外整合了部分地区用字习惯的规则；
* 在上述基础上去掉了四个字以上的转换规则，部分人名条目，和一些冗余的规则；
* 此外还有一些另行添加或修改的规则项目。

繁简转换的词典见 `./han/` 目录。繁简转换相关逻辑请参考 https://github.com/tiansh/opencc-fsm 项目。

## Open Source Credits

* normalize.css: from normalize v8.0.1
    * MIT License; https://github.com/necolas/normalize.css
* icon.svg / icon.woff based on Feather
    * MIT License; https://github.com/feathericons/feather
* pako: JavaScript port of zlib
    * MIT License, ZLIB License: https://github.com/nodeca/pako
* s2t.json, t2s.json Chinese traditional / simplified translation tables based on OpenCC
    * Apache License 2.0; https://github.com/BYVoid/OpenCC
    * For more details about the modification, see https://github.com/tiansh/opencc-fsm

## About

Copyright (C) 2020-2023 田生

This project is released under the Mozilla Public License 2.0 with no copyleft exception. You may checkout LICENSE file for more detail.

