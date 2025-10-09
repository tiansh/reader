/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */


import config from '../../../data/config.js';
import speech from '../../../text/speech.js';
import wakelock from '../../../ui/util/wakelock.js';
import ReadPage from '../readpage.js';

/**
 * @typedef {'ready' | 'speaking' | 'more' | 'stopping' | 'stopped'} SpeechState
 * Ready: Ready to start speaking; (stable)
 * Speaking: Speaking; (stable)
 * More: Prepare following ssu for speaking; transfer to Speaking when done
 * Stopping: Stopping the speech; transfer to Stopped when done
 * Stopped: Speaking stopped, 1s interval is required before transfer to Ready due to iOS bug(?)
 */
/** @typedef {'stop' | 'paused' | 'play' | 'reset'} UserState */

export default class ReadSpeech {
  /**
   * @param {ReadPage} page
   */
  constructor(page) {
    if (ReadSpeech.instance) {
      ReadSpeech.instance.page = page;
      return ReadSpeech.instance;
    }
    ReadSpeech.instance = this;

    this.page = page;

    this.onSsuStart = this.onSsuStart.bind(this);
    this.onSsuBoundary = this.onSsuBoundary.bind(this);
    this.onSsuEnd = this.onSsuEnd.bind(this);
    this.onSsuError = this.onSsuError.bind(this);
    this.onMediaKey = this.onMediaKey.bind(this);
    this.handleMediaSessionWhenStateChange = this.handleMediaSessionWhenStateChange.bind(this);
    this.handleAutoLockWhenStateChange = this.handleAutoLockWhenStateChange.bind(this);

    /** @type {WeakMap<SpeechSynthesisUtterance, { start: number, end: number }>} */
    this.ssuInfo = new WeakMap();
    /** @type {Set<SpeechSynthesisUtterance> | null} */
    this.pendingSsu = null;
    /** @type {SpeechSynthesisUtterance | null} */
    this.speakingSsu = null;

    this.listenEvents();

    this.reportSpeechState('ready');
    /** @type {UserState} */
    this.userState = 'stop';
    /** @type {UserState} */
    this.targetUserState = 'stop';
    /** @type {((state: UserState) => void)[]} */
    this.stateChangeListeners = [];
  }
  async init() {
    /** @type {'normal' | 'speech' | 'disable'} */
    this.autoLockConfig = await config.get('auto_lock', 'speech');
    /** @type {'continue' | 'pause'} */
    this.pauseInBackground = speech.supportBackground() ? await config.get('speech_pause_in_background', 'continue') : 'pause';
    const normalize = (n, defaultValue) => n < 0 ? defaultValue : Math.round(n);
    // EXPERT_CONFIG Maximum character allowed in a single speech instance
    this.speechTextMaxLength = await config.expert('speech.max_char_length', 'number', 1000, { normalize });
    // EXPERT_CONFIG Prepare how many ssu when speaking
    this.maxPendingSsuSize = await config.expert('speech.queue_size', 'number', 10, { normalize });
    // EXPERT_CONFIG Enable media session so it can be controlled by system provided panel
    this.mediaSessionEnable = ('mediaSession' in navigator) &&
      (await config.expert('speech.media_session_enable', 'boolean', false));
    // EXPERT_CONFIG Skip certain any texts matching given regex when speaking
    this.speechTextSkipRegex = await config.expert('speech.skip_text_regex', 'string', /^\s*$/, {
      normalize: (/** @type {string} */value, defaultValue) => {
        if (/^\/.*\/\w+$/.test(value)) {
          try {
            const source = value.slice(value.indexOf('/') + 1, value.lastIndexOf('/'));
            const flags = value.slice(value.lastIndexOf('/') + 1);
            return new RegExp(source, flags);
          } catch (e1) {
            // fall
          }
        }
        try {
          return new RegExp(value);
        } catch (e2) {
          // fall
        }
        return defaultValue;
      },
    });
    // EXPERT_CONFIG Loop when speech reach end of text
    this.enableLoop = await config.expert('speech.loop_enable', 'boolean', false);
    // EXPERT_CONFIG Append some text for each line
    // zh-CN and zh-HK voices on iOS 17 failed to speak anything wraped in a pair of quotes (“”).
    // Append some extra text as a workaround.
    const isBuggyVoice = [
      'com.apple.voice.compact.zh-CN.Tingting',
      'com.apple.voice.super-compact.zh-CN.Tingting',
      'com.apple.voice.compact.zh-HK.Sinji',
      'com.apple.voice.super-compact.zh-HK.Sinji',
    ].includes(speech.getPreferVoice()?.voiceURI) && / OS 17_/.test(navigator.userAgent);
    this.extraSuffix = await config.expert('speech.extra_suffix', 'string', isBuggyVoice ? '“”。' : '');

    this.initMediaSession();
    this.initWakeLock();
  }
  /** @param {SpeechState} state */
  reportSpeechState(state) {
    /** @type {SpeechState} */
    this.speechState = state;
    const changed = this.speechStateChanged;
    /** @type {Promise<SpeechState>} */
    this.speechStateChangePromise = new Promise(resolve => {
      this.speechStateChanged = resolve;
    });
    if (changed) changed(state);
  }
  untilSpeechStateChange() {
    return this.speechStateChangePromise;
  }
  async untilSpeechStateStable() {
    while (!['ready', 'speaking'].includes(this.speechState)) {
      await this.untilSpeechStateChange();
    }
  }
  reportUserState(state) {
    const stateBefore = this.userState;
    this.userState = state;
    this.stateChangeListeners.forEach(f => {
      try { f(state, stateBefore); } catch (e) { console.error(e); }
    });
  }
  /** @param {(state: UserState, stateBefore: UserState) => void} listener */
  addStateChangeListener(listener) {
    const list = this.stateChangeListeners;
    if (list.indexOf(listener) === -1) list.push(listener);
  }
  /** @param {(state: UserState, stateBefore: UserState) => void} listener */
  removeStateChangeListener(listener) {
    const list = this.stateChangeListeners;
    const pos = list.indexOf(listener);
    if (pos !== -1) list.splice(pos, 1);
    return pos !== -1;
  }

  isSpeaking() {
    return this.speechState === 'speaking' || this.speechState === 'more';
  }

  isWorking() {
    return this.userState !== 'stop';
  }
  isPaused() {
    return this.userState === 'paused';
  }
  isPlaying() {
    return this.userState === 'play';
  }
  isReseting() {
    return this.targetUserState === 'reset';
  }

  listenEvents() {
    this.listenMediaDeviceChange();
    this.listenBeforeUnload();
    this.listenVisibilityChange();
  }
  listenBeforeUnload() {
    window.addEventListener('beforeunload', event => {
      this.stop();
    });
  }
  listenVisibilityChange() {
    this.hiddenPause = false;
    document.addEventListener('visibilitychange', event => {
      if (this.pauseInBackground === 'continue') return;
      if (this.isSpeaking() && document.hidden) {
        this.hiddenPause = true;
        this.pause();
      }
      if (this.hiddenPause && this.isPaused() && !document.hidden) {
        this.hiddenPause = false;
        this.start();
      }
    });
  }
  async listenMediaDeviceChange() {
    if (!navigator.mediaDevices) return false;
    if (!navigator.mediaDevices.enumerateDevices) return false;
    let audioOutputCount = null;
    return new Promise(resolve => {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        audioOutputCount = devices.filter(x => x.kind === 'audiooutput').length;
        navigator.mediaDevices.addEventListener('devicechange', () => {
          navigator.mediaDevices.enumerateDevices().then(devices => {
            const count = devices.filter(x => x.kind === 'audiooutput').length;
            if (count < audioOutputCount) this.stop();
            audioOutputCount = count;
          });
        });
        resolve(true);
      });
    });
  }

  /** @param {SpeechSynthesisEvent} event */
  onSsuStart(event) {
    if (!this.isSpeaking()) return;
    /** @type {SpeechSynthesisUtterance} */
    const ssu = event.target;
    const ssuInfo = this.getSsuInfo(ssu);
    if (!ssuInfo) return;
    this.speakingSsu = ssu;
    this.pendingSsu.delete(ssu);
    const start = ssuInfo.start;
    this.page.textPage.highlightChars(start, 0);
    this.readMore();
  }
  /** @param {SpeechSynthesisEvent} event */
  onSsuBoundary(event) {
    if (!this.isSpeaking()) return;
    const boundaryCursor = this.boundaryCursor = {};
    const ssu = event.target;
    const ssuInfo = this.getSsuInfo(ssu);
    if (!ssuInfo) return;
    const charIndex = event.charIndex == null ? 0 : event.charIndex;
    const charLength = event.charLength == null ? Infinity : event.charLength;
    const start = ssuInfo.start + charIndex;
    const len = Math.max(0, Math.min(charLength, ssuInfo.end - start));
    if (Number.isInteger(start) && Number.isInteger(len) && start >= 0 && len >= 0) {
      this.page.textPage.highlightChars(start, len);
    } else {
      this.reset();
    }
    this.spoken = start;
    if (this.boundaryCursor === boundaryCursor) {
      this.boundaryCursor = null;
    }
    this.readMore();
  }
  /** @param {SpeechSynthesisEvent} event */
  onSsuEnd(event) {
    if (!this.isSpeaking()) return;
    this.speakingSsu = null;
    const ssu = event.target;
    ssu.removeEventListener('start', this.onSsuStart);
    ssu.removeEventListener('boundary', this.onSsuBoundary);
    ssu.removeEventListener('end', this.onSsuEnd);
    ssu.removeEventListener('error', this.onSsuError);
    const ssuInfo = this.getSsuInfo(ssu);
    if (!ssuInfo) return;
    if (!this.page.textPage) {
      this.stop();
      return;
    }
    this.page.textPage.clearHighlight();
    this.spoken = ssuInfo.end;
    this.readMore();
  }
  onSsuError(event) {
    if (!this.isSpeaking()) return;
    this.stop();
  }
  getSsuInfo(ssu) {
    const info = this.ssuInfo.get(ssu);
    if (!info) this.reset();
    return info;
  }
  readEnd() {
    if (this.enableLoop) {
      this.pause();
      this.page.setCursor(0, { resetSpeech: true, resetRender: false });
      this.start();
    } else {
      this.stop();
    }
  }
  readNext() {
    const content = this.page.content;
    let current = null, text = null, end = null;
    do {
      if (this.next === content.length) return null;
      current = this.next;
      const line = content.indexOf('\n', current) + 1;
      end = Math.min(line || content.length, current + this.speechTextMaxLength);
      this.next = end;
      text = content.slice(current, end).trimRight();
    } while (!text || this.speechTextSkipRegex.test(text));
    const ssu = speech.prepare(text + this.extraSuffix);
    this.ssuInfo.set(ssu, { start: current, end });
    ssu.addEventListener('start', this.onSsuStart);
    ssu.addEventListener('boundary', this.onSsuBoundary);
    ssu.addEventListener('end', this.onSsuEnd);
    ssu.addEventListener('error', this.onSsuError);
    this.pendingSsu.add(ssu);
    speechSynthesis.speak(ssu);
    return ssu;
  }
  async readMore() {
    if (!this.isSpeaking()) return;
    if (this.speechState === 'more') return;
    this.reportSpeechState('more');
    const length = this.page.content.length;
    while (
      this.isSpeaking() && this.targetUserState === 'play' &&
      this.pendingSsu && this.pendingSsu.size < this.maxPendingSsuSize &&
      this.readNext()
    ) {
      await new Promise(resolve => { setTimeout(resolve, 0); });
    }
    if (!(this.isSpeaking() && this.targetUserState === 'play')) return;
    this.reportSpeechState('speaking');
    if (!this.pendingSsu.size && !this.speakingSsu) {
      this.readEnd();
    }
  }
  spokenInPage() {
    if (this.spoken == null) return false;
    return this.page.textPage.isInPage(this.spoken);
  }
  async startSpeech() {
    if (this.targetUserState !== 'play') return;
    await this.untilSpeechStateStable();
    if (this.isSpeaking()) return;
    this.next = this.page.getRenderCursor();
    if (this.spoken != null && this.spokenInPage()) {
      this.next = this.spoken;
    }
    this.spoken = this.next;
    this.pendingSsu = new Set();
    this.speakingSsu = null;
    this.reportSpeechState('speaking');

    this.readMore();
  }
  async stopSpeech() {
    if (this.targetUserState === 'play') return;
    await this.untilSpeechStateStable();
    if (!this.isSpeaking()) return;
    this.reportSpeechState('stopping');
    this.page.textPage?.clearHighlight();
    while (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    this.pendingSsu = null;
    this.speakingSsu = null;
    this.reportSpeechState('stopped');
    setTimeout(() => {
      this.reportSpeechState('ready');
    }, 1e3);
  }
  async pause() {
    await this.adjustUserState('paused');
  }
  async start() {
    await this.adjustUserState('play');
  }
  async stop() {
    await this.adjustUserState('stop');
  }
  async reset() {
    await this.adjustUserState('reset');
  }
  /** @param {UserState} targetUserState */
  async adjustUserState(targetUserState) {
    this.targetUserState = targetUserState;
    const token = this.adjustUserStateToken = Symbol();
    while (true) {
      await this.untilSpeechStateStable();
      if (this.adjustUserStateToken !== token) return;
      if (this.targetUserState === 'play' && !this.isSpeaking()) {
        await this.startSpeech();
      } else if (this.targetUserState !== 'play' && this.isSpeaking()) {
        await this.stopSpeech();
      }
      if (this.targetUserState === 'play' && this.isSpeaking()) {
        this.reportUserState(this.targetUserState);
      } else if (this.targetUserState === 'reset') {
        if (!this.isSpeaking()) this.targetUserState = 'play';
        continue;
      } else if (this.targetUserState !== 'play' && !this.isSpeaking()) {
        this.reportUserState(this.targetUserState);
      } else continue;
      break;
    }
  }
  cursorChange(cursor, config) {
    if (this.isPlaying() || this.isReseting()) {
      if (this.boundaryCursor) return;
      if (config.resetSpeech) {
        this.reset();
      }
    } else {
      this.spoken = null;
    }
  }

  initMediaSession() {
    if (!this.mediaSessionEnable) return;
    this.addStateChangeListener(this.handleMediaSessionWhenStateChange);
  }
  async handleMediaSessionWhenStateChange(state, stateBefore) {
    if (state === 'play' && stateBefore !== 'play') {
      this.fakeAudio.currentTime = 0;
      await this.fakeAudio.play();
    } else if (state !== 'play' && stateBefore === 'play') {
      if (this.fakeAudio) this.fakeAudio.pause();
    } else return;
    this.updateMediaSession();
  }
  metaLoad(meta) {
    this.stop();
    this.metadata = meta;
    if (!this.mediaSessionEnable) return;
    this.fakeAudio = new Audio([
      'data:audio/mp3;base64,',
      'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjgzLjEwMAAAAAAAAAAAAAAA/+M4AAAAAA',
      'AAAAAAAAAAAAAAAAAASW5mbwAAAA8AAANEAADr+AAEBwkLDhATFRgaHCAjJScqLC8xNDY5',
      'PD9BREZIS01QUlVYW11gYmRnaWxucXR3eXx+gYOFiIqNkJOVmJqdn6Kkpqmtr7G0trm7vs',
      'DCxcnLzdDS1dfa3N/h5efq7O7x8/b4+/0AAAAATGF2YzU3LjEwAAAAAAAAAAAAAAAAJAPA',
      'AAAAAAAA6/hWiK+yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      `/+MYZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAw${'V'.repeat(56)}`.repeat(336),
    ].join(''));
    this.fakeAudio.loop = true;
    document.body.appendChild(this.fakeAudio);
    this.updateMediaSession();
    const action = start => () => {
      if (this.mediaKey) return;
      this.mediaKey = true;
      if (start) this.start();
      else this.stop();
      // This is a dirty hack to avoid both this handler and
      // keyboard event handler triggered
      // I didn't find any better way to prevent duplicate
      // handler triggered
      setTimeout(() => { this.mediaKey = false; }, 500);
    };
    navigator.mediaSession.setActionHandler('play', action(true));
    navigator.mediaSession.setActionHandler('pause', action(false));
    navigator.mediaSession.setActionHandler('stop', action(false));
    document.addEventListener('keydown', this.onMediaKey);
  }
  metaUnload() {
    this.stop();
    this.metadata = null;
    if (!this.mediaSessionEnable) return;
    document.removeEventListener('keydown', this.onMediaKey);
    if (this.fakeAudio) {
      this.fakeAudio.pause();
      document.body.removeChild(this.fakeAudio);
      this.fakeAudio = null;
    }
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('stop', null);
    this.updateMediaSession();
  }
  /** @param {KeyboardEvent} event */
  onMediaKey(event) {
    if (!this.mediaSessionEnable) return;
    if (this.mediaKey) return;
    const key = event.key;
    let action = null;
    if (key === 'MediaPlayPause') {
      action = this.userState !== 'play';
    } else if (key === 'MediaStop') {
      action = false;
    }
    if (action == null) return;
    if (action) this.start();
    else this.stop();
    this.mediaKey = true;
    setTimeout(() => { this.mediaKey = false; }, 500);
  }
  updateMediaSession() {
    if (!this.mediaSessionEnable) return;
    const meta = this.metadata;
    if (meta) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: meta.title });
      navigator.mediaSession.playbackState = this.isSpeaking() ? 'playing' : 'paused';
      navigator.mediaSession.setPositionState({ duration: 0, playbackRate: 1, position: 0 });
    } else {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'paused';
      navigator.mediaSession.setPositionState();
    }
  }

  initWakeLock() {
    this.addStateChangeListener(this.handleAutoLockWhenStateChange);
  }
  async handleAutoLockWhenStateChange(state, stateBefore) {
    if (this.autoLockConfig !== 'speech') return;
    if (state === 'play' && stateBefore !== 'play') {
      wakelock.request();
    } else if (state !== 'play' && stateBefore === 'play') {
      wakelock.release();
    }
  }
}

