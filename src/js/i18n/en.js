export default {
  listSortTitle: 'Sort',
  listSortByDateRead: 'Date Read',
  listSortByDateAdd: 'Date Add',
  listSortByTitle: 'Title',
  listSortCancel: 'Cancel',
  listImportTip: 'Reading text file...',
  listImportFail: 'Something wrong when reading text file. Maybe the encoding is not supported.',
  listNotYetRead: 'NEW',
  listEmptyTip: 'Tap the add mark on right top to import files',

  readContentsTemplate: 'Template for table of content',
  readContentsEmpty: 'No table of contents yet.\nClick refresh button to build one.',
  readBookmarkEmpty: 'No bookmarks yet.\nClick add bookmark button to add one.',
  readSearchPlaceholder: 'Find what',
  readSearchInitial: 'Input some words so you can find them in text...',
  readSearchEmpty: 'Cannot find "{0}"',
  readSearchTooMany: 'Found {0} results; Tap to find more',

  configThemeGroupTitle: 'Theme',
  configTheme: 'Theme',
  configThemeAuto: 'Auto',
  configThemeLight: 'Light',
  configThemeDark: 'Dark',
  configDarkThemeGroupTitle: 'Dark Theme',
  configDarkThemeColor: 'Reader Text',
  configDarkThemeBackground: 'Reader Background',
  configLightThemeGroupTitle: 'Light Theme',
  configLightThemeColor: 'Reader Text',
  configLightThemeBackground: 'Reader Background',
  configTextGroupTitle: 'Reader Text',
  configTextFontFamily: 'Font Family',
  configTextFontFamilyUpload: 'Select Font File',
  configTextFontFamilyDefault: 'Default Font',
  configTextFontFamilyCustom: 'Custom Font',
  configTextFontSize: 'Font Size',
  configTextFontSizeNum: '{0}',
  configPreprocessGroupTitle: 'Preprocess',
  configPreprocessMultipleNewLine: 'Max New Lines',
  configPreprocessMultipleNewLineNum: 'Up to {0}',
  configPreprocessMultipleNewLineDisable: 'Not Limited',
  configPreprocessChineseConvert: 'Han Convert',
  configPreprocessChineseConvertS2T: 'Simp. To Trad.',
  configPreprocessChineseConvertT2S: 'Trad. To Simp.',
  configPreprocessChineseConvertDisabled: 'Not Applied',
  configSpeechGroupTitle: 'Speech',
  configSpeechVoice: 'Voice',
  configSpeechVoiceRemote: '(Remote)',
  configSpeechVoiceEmpty: 'No available speech voice detected.',
  configSpeechPitch: 'Speech Pitch',
  configSpeechPitchNum: pitch => {
    if (pitch === 0) return '0 (lowest)';
    if (pitch === 2) return '2 (highest)';
    if (pitch === 1) return '1 (default)';
    else return String(pitch);
  },
  configSpeechRate: 'Speech Rate',
  configSpeechRateNum: rate => {
    if (rate === 1) return '1x (normal)';
    return rate + 'x';
  },
};
