/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

export default {
  locale: 'en',

  listFilterClear: 'Clear Search',
  listSortTitle: 'Sort by',
  listSortByDateRead: 'Date Read',
  listSortByDateAdd: 'Date Add',
  listSortByTitle: 'Title',
  listSortCancel: 'Cancel',
  listImportTip: 'Reading text file...',
  listImportFail: 'Something wrong when reading text file. Maybe the encoding is not supported.',
  listNotYetRead: 'NEW',
  listSearchPlaceholder: 'Search',
  listEmptySearchTip: 'Cannot find files match searching',
  listEmptyTip: 'Tap the add mark import files',

  readContentsTemplate: 'Template',
  readContentsTemplateDescription: 'Template for the table of content: Use asterisk (*) for wildcard',
  readContentsTemplateHistory: 'Recent',
  readContentsTemplateClear: 'Clear Recent',
  readContentsEmpty: 'No table of contents yet.\nYou may click refresh button to build one.',
  readBookmarkEmpty: 'No bookmarks yet.\nYou may click add bookmark button to add one.',
  readSearchPlaceholder: 'Search',
  readSearchInitial: 'Input some words so you can find them in text...',
  readSearchEmpty: 'Cannot find "{0}"',
  readSearchTooMany: '{0} results found; Find More',
  readPagePrevious: 'Previous Page',
  readPageNext: 'Next Page',

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
  configTextLineHeight: 'Line Height',
  configTextLineHeightNum: '{0}',
  configTextParagraphSpacing: 'Paragraph Spacing',
  configTextParagraphSpacingNum: '{0} lines',
  configTextLangTag: 'Language Tag',
  configTextLangTagTitle: 'Lang',
  configTextLangTagDescription: 'This language tag will be used to render text content. This may cause different behavior of line breaking, and Han character rendering.',
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
    if (rate === 1) return '1× (normal)';
    return rate + '×';
  },
  configHelpGroupTitle: 'Help',
  configHelpCredits: 'Open Source Credits',
  configHelpAbout: 'About',

  buttonRemove: 'Remove',
  buttonBack: 'Back',
  buttonAdd: 'Import File',
  buttonSettings: 'Settings',
  buttonContents: 'Table of Contents',
  buttonBookmark: 'Bookmark',
  buttonSearch: 'Search',
  buttonJump: 'Jump to',
  buttonSpeech: 'Start Text to Speech',
  buttonSpeechStop: 'Stop Text to Speech',
  buttonContentsRefresh: 'Refresh Table of Contents',
  buttonSearchClear: 'Clear Search Result',
  buttonBookmarkAdd: 'Add Bookmark',

  colorHueRange: 'Hue',
  colorSaturationRange: 'Saturation',
  colorValueRange: 'Value',

};
