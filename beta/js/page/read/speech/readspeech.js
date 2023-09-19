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
import ReadPage from '../readpage.js';

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

    this.onStart = this.onStart.bind(this);
    this.onBoundary = this.onBoundary.bind(this);
    this.onEnd = this.onEnd.bind(this);
    this.onError = this.onError.bind(this);
    this.onMediaKey = this.onMediaKey.bind(this);

    /** @type {WeakMap<SpeechSynthesisUtterance, { start: number, end: number }>} */
    this.ssuInfo = new WeakMap();

    this.listenEvents();
  }
  async init() {
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
    // EXPERT_CONFIG Pause reading when webpage is been hidden (user switched to other tabs)
    this.pauseOnHidden = await config.expert('speech.pause_on_hidden', 'boolean', false);
    // EXPERT_CONFIG Append some text for each line
    this.extraSuffix = await config.expert('speech.extra_suffix', 'string', '');

    this.speaking = false;
    this.spoken = null;
    this.speakingSsu = null;
  }
  listenEvents() {
    this.listenMediaDeviceChange();
    window.addEventListener('beforeunload', event => {
      this.stop();
    });
    if (this.pauseOnHidden) {
      this.hiddenPause = false;
      document.addEventListener('visibilitychange', event => {
        if (this.speaking && document.hidden) {
          this.hiddenPause = true;
          this.stop();
        }
        if (this.hiddenPause && !document.hidden) {
          this.hiddenPause = false;
          this.reset();
        }
      });
    }
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
  onStart(event) {
    if (!this.speaking) return;
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
  onBoundary(event) {
    if (!this.speaking) return;
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
  onEnd(event) {
    if (!this.speaking) return;
    this.speakingSsu = null;
    const ssu = event.target;
    ssu.removeEventListener('start', this.onStart);
    ssu.removeEventListener('boundary', this.onBoundary);
    ssu.removeEventListener('end', this.onEnd);
    ssu.removeEventListener('error', this.onError);
    const ssuInfo = this.getSsuInfo(ssu);
    if (!ssuInfo) return;
    if (!this.page.textPage) {
      this.stop();
      return;
    }
    this.page.textPage.clearHighlight();
    this.sopken = ssuInfo.end;
    this.readMore();
  }
  onError(event) {
    if (!this.speaking) return;
    this.stop();
  }
  getSsuInfo(ssu) {
    const info = this.ssuInfo.get(ssu);
    if (!info) this.reset();
    return info;
  }
  readEnd() {
    if (this.enableLoop) {
      this.reset();
      this.page.setCursor(0, { resetSpeech: true, resetRender: false });
    } else {
      this.stop();
    }
  }
  readNext() {
    const content = this.page.content;
    let current = null, text = null, end = null;
    do {
      if (this.next === content.length) return;
      current = this.next;
      const line = content.indexOf('\n', current) + 1;
      end = Math.min(line || content.length, current + this.speechTextMaxLength);
      this.next = end;
      text = content.slice(current, end).trimRight();
    } while (!text || this.speechTextSkipRegex.test(text));
    const ssu = speech.prepare(text + this.extraSuffix);
    this.ssuInfo.set(ssu, { start: current, end });
    ssu.addEventListener('start', this.onStart);
    ssu.addEventListener('boundary', this.onBoundary);
    ssu.addEventListener('end', this.onEnd);
    ssu.addEventListener('error', this.onError);
    this.pendingSsu.add(ssu);
    speechSynthesis.speak(ssu);
  }
  async readMore() {
    if (this.lastReset) return;
    if (!this.speaking) return;
    if (this.readMoreBusy) return;
    this.readMoreBusy = true;
    const length = this.page.content.length;
    while (
      this.speaking &&
      this.pendingSsu.size < this.maxPendingSsuSize &&
      this.next < length
    ) {
      this.readNext();
      await new Promise(resolve => { setTimeout(resolve, 0); });
    }
    this.readMoreBusy = false;
    if (!this.speaking) return;
    if (!this.pendingSsu.size && !this.speakingSsu) {
      this.readEnd();
    }
  }
  spokenInPage() {
    if (this.spoken == null) return false;
    return this.page.textPage.isInPage(this.spoken);
  }
  async start() {
    if (this.lastReset) return;
    if (this.speaking || this.stopping) return;
    if (speechSynthesis.speaking || speechSynthesis.pending) return;
    this.readMoreBusy = false;
    const page = this.page;
    page.element.classList.add('read-speech');
    this.next = page.getRenderCursor();
    if (this.spoken != null && this.spokenInPage()) {
      this.next = this.spoken;
    }
    this.spoken = this.next;
    this.pendingSsu = new Set();
    this.speaking = true;
    if (this.mediaSessionEnable) {
      this.fakeAudio.currentTime = 0;
      await this.fakeAudio.play();
      this.updateMediaSession();
    }
    this.readMore();
  }
  async stop() {
    if (!this.speaking) return;
    if (this.stopping) {
      await this.stopping;
      return;
    }
    this.page.element.classList.remove('read-speech');
    this.page.textPage.clearHighlight();
    this.speaking = false;
    let stopped = null;
    this.stopping = new Promise(resolve => { stopped = resolve; });
    while (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    this.pendingSsu = null;
    this.speakingSsu = null;
    while (this.readMoreBusy) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    this.stopping = false;
    stopped();
    if (this.mediaSessionEnable) {
      if (this.fakeAudio) this.fakeAudio.pause();
      this.updateMediaSession();
    }
  }
  async reset() {
    const token = this.lastReset = {};
    await this.stop();
    /*
     * FIXME
     * I don't know why!
     * But safari doesn't work if we don't give a pause.
     * I'm not sure how long would be suitable.
     * I just make it work on my iPhone with 1s delay.
     * This should be changed to something more meaningful.
     */
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (token !== this.lastReset) return;
    this.lastReset = null;
    await this.start();
  }
  async toggle() {
    if (this.lastReset || this.stopping) return;
    if (this.speaking) await this.stop();
    else await this.start();
  }
  cursorChange(cursor, config) {
    if (this.speaking || this.lastReset) {
      if (this.boundaryCursor) return;
      if (config.resetSpeech) {
        this.reset();
      }
    } else {
      this.spoken = null;
    }
  }
  /* global MediaMetadata: false */
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
      action = !this.speaking && !this.stopping;
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
      navigator.mediaSession.playbackState = this.speaking ? 'playing' : 'paused';
      navigator.mediaSession.setPositionState({ duration: 0, playbackRate: 1, position: 0 });
    } else {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'paused';
      navigator.mediaSession.setPositionState();
    }
  }
  isWorking() {
    return Boolean(this.speaking || this.stopping || this.lastReset);
  }
}

