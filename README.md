自用 txt 阅读器

## 开发

直接把 src 目录扔到随便什么 HTTP 服务器下面，浏览器打开就可以调试了。并没有 WebPack 之类的东西。

## 使用

Safari 打开，选择“添加到主屏幕”，然后就可以用了。

* 点左上角的添加可以添加文件
    * 文件可以从本机、iCloud 或者 OneDrive，MEGA 之类的地方选择
* 设置：
    * 右上角齿轮可以进设置，不过设置很简陋就是了
    * 设置里面可以传个字体进去，毕竟打包个盗版字体不太好，但是用户自己传的就与我无关了
    * 字体主要看 Safari 支持什么格式，常见的应该是 \*.ttf 格式
* 阅读界面：
    * 左滑，点右侧：下一页
    * 右滑，点左侧：上一页
    * 上滑，点中间：显示菜单
    * 下滑：显示目录，书签或搜索
* 目录：
    * 点右上角的刷新图标可以生成或刷新目录，会要求输入目录的模板。如果每个章节都是“第三章　章节标题”这样的格式，那么就填写“第\*章 ”。用“/”开头和结尾的话可以写正则表达式。
* 书签：
    * 点右上角那个可以添加书签
* 搜索：
    * 搜索时每行只匹配第一个结果。所以如果一行里面出现多次也只会匹配出来第一次而已

Android 的话作者没试过，反正与我无关。

## credit

* normalize.css v8.0.1 from normalize; MIT License; github.com/necolas/normalize.css
* icon.svg / icon.woff based on Feather; MIT License; https://github.com/feathericons/feather
