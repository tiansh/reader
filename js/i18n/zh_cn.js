export default {
  listSortTitle: '排序',
  listSortByDateRead: '按最后阅读时间',
  listSortByDateAdd: '按添加时间',
  listSortByTitle: '按标题',
  listSortCancel: '取消',
  listImportTip: '正在读取文本……',
  listImportFail: '读取文本时发生错误\n文本可能使用了不支持的字符编码',

  readContentTemplate: '目录模板',
  readContentEmpty: '暂无目录\n点击刷新按钮生成目录',
  readBookmarkEmpty: '暂无书签\n点击添加按钮添加书签',
  readSearchPlaceholder: '查找',
  readSearchInitial: '键入文本以查找',
  readSearchEmpty: '找不到 {0}',
  readSearchTooMany: '已找到 {0} 个结果，点击以继续查找',

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
  configTextFontSize: '字号',
  configTextFontSizeNum: '{0}',
  configPreprocessGroupTitle: '预处理',
  configPreprocessMultipleNewLine: '压缩连续空行至',
  configPreprocessMultipleNewLineNum: '{0}行',
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
    if (rate === 1) return '1x (默认)';
    return rate + 'x';
  },
};
