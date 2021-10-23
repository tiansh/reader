/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

export default {
  locale: 'zh-CN',

  title: 'tReader',
  titleWithName: '{0} - tReader',

  listFilterClear: '取消过滤',
  listSortTitle: '排序',
  listSortByDateRead: '按最后阅读时间',
  listSortByDateAdd: '按添加时间',
  listSortByTitle: '按标题',
  listSortCancel: '取消',
  listImportTip: '正在读取文本……',
  listNotYetRead: '新',
  listSearchPlaceholder: '搜索',
  listEmptySearchTip: '找不到搜索的文件',
  listEmptyTip: '点击加号图标导入文件',

  readContentsTemplate: '目录模板',
  readContentsTemplateDescription: '使用星号(*)作通配符',
  readContentsTemplateHistory: '最近设置模板',
  readContentsTemplateSubmit: '生成目录',
  readContentsTemplateClear: '清空',
  readContentsEmpty: '暂无目录\n点击刷新按钮生成目录',
  readBookmarkEmpty: '暂无书签\n点击添加按钮添加书签',
  readSearchPlaceholder: '查找',
  readSearchInitial: '键入文本以查找',
  readSearchEmpty: '找不到 {0}',
  readSearchTooMany: '已找到 {0} 个结果，点击以继续查找',
  readPagePrevious: '上一页',
  readPageNext: '下一页',
  readPageScrollUp: '向上翻',
  readPageScrollDown: '向下翻',
  readControlClose: '隐藏按钮',
  readAutoScrollStop: '停止滚动',

  configWithDetail: '详情',
  configModeGroupTitle: '模式',
  configMode: '阅读模式',
  configModeFlip: '翻页',
  configModeScroll: '滚动',
  configThemeGroupTitle: '主题',
  configTheme: '主题',
  configThemeAuto: '自动',
  configThemeLight: '浅色',
  configThemeDark: '深色',
  configDarkThemeGroupTitle: '深色主题',
  configDarkThemeColor: '阅读文字',
  configDarkThemeBackground: '阅读背景',
  configLightThemeGroupTitle: '浅色主题',
  configLightThemeColor: '阅读文字',
  configLightThemeBackground: '阅读背景',
  configTextGroupTitle: '阅读文字',
  configTextFontFamily: '字体',
  configTextFontFamilyUpload: '浏览字体文件',
  configTextFontFamilyDefault: '默认字体',
  configTextFontFamilyCustom: '定制字体',
  configTextFontSize: '字号',
  configTextFontSizeNum: '{0}',
  configTextLineHeight: '行高',
  configTextLineHeightNum: '{0}',
  configTextParagraphSpacing: '段间距',
  configTextParagraphSpacingNum: '{0} 行',
  configTextLangTag: '语言标记',
  configTextLangTagTitle: '语言标记',
  configTextLangTagDescription: '语言标记用于标记文本的语言。语言标记可能会影响汉字的渲染和文字的换行。',
  configPreprocessGroupTitle: '预处理',
  configPreprocessMultipleNewLine: '压缩连续空行至',
  configPreprocessMultipleNewLineNum: '{0} 行',
  configPreprocessMultipleNewLineDisable: '不压缩',
  configPreprocessChineseConvert: '汉字繁简转换',
  configPreprocessChineseConvertS2T: '简体转繁体',
  configPreprocessChineseConvertT2S: '繁体转简体',
  configPreprocessChineseConvertDisabled: '不使用',
  configSpeechGroupTitle: '朗读',
  configSpeechVoice: '语音',
  configSpeechVoiceRemote: '(远程)',
  configSpeechVoiceEmpty: '未发现可用的语音',
  configSpeechPitch: '语调',
  configSpeechPitchNum: pitch => {
    if (pitch === 0) return '0 (最低)';
    if (pitch === 2) return '2 (最高)';
    if (pitch === 1) return '1 (默认)';
    else return String(pitch);
  },
  configSpeechRate: '语速',
  configSpeechRateNum: rate => {
    if (rate === 1) return '1× (默认)';
    return rate + '×';
  },
  configHelpGroupTitle: '帮助',
  configHelpCredits: 'Open Source Credits',
  configHelpAbout: '关于',
  configExpertGroupTitle: '高级',
  configExpert: '高级设置',
  configExpertDescription: '如果您不清楚应当如何填写请将此处留空，错误配置可能导致阅读器无法使用',

  buttonRemove: '删除',
  buttonBack: '返回',
  buttonAdd: '添加文件',
  buttonSettings: '设置',
  buttonContents: '目录',
  buttonBookmark: '书签',
  buttonSearch: '搜索',
  buttonJump: '跳转',
  buttonSpeech: '开始朗读',
  buttonSpeechStop: '停止朗读',
  buttonContentsRefresh: '刷新目录',
  buttonSearchSubmit: '搜索',
  buttonSearchClear: '清除搜索结果',
  buttonBookmarkAdd: '添加书签',

  colorHueRange: '色相',
  colorSaturationRange: '饱和度',
  colorValueRange: '明度',

  listImportFail: '读取文本时发生错误\n文本可能使用了不支持的字符编码',
  storageOpenFail: '无法访问设备的存储\ntReader 需要访问存储以正常工作\n这可能是因为您启用了浏览器的无痕（隐私）模式或您的浏览器版本不受支持',
};
