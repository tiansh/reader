/*!
 * @license MPL-2.0-no-copyleft-exception
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */


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

    this.readBuffer = 500;
    this.maxPendingSsuSize = 10;

    this.page = page;

    this.speaking = false;
    this.spoken = null;
    this.speakingSsu = null;

    this.listenEvents();

    this.onStart = this.onStart.bind(this);
    this.onBoundary = this.onBoundary.bind(this);
    this.onEnd = this.onEnd.bind(this);
    this.onError = this.onError.bind(this);
    this.onMediaKey = this.onMediaKey.bind(this);

    /** @type {WeakMap<SpeechSynthesisUtterance, { start: number, end: number }>} */
    this.ssuInfo = new WeakMap();
  }
  listenEvents() {
    this.listenMediaDeviceChange();
    window.addEventListener('beforeunload', event => {
      this.stop();
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
  onStart(event) {
    /** @type {SpeechSynthesisUtterance} */
    this.speakingSsu = event.target;
  }
  /** @param {SpeechSynthesisEvent} event */
  onBoundary(event) {
    if (!this.speaking) return;
    const boundaryCursor = this.boundaryCursor = {};
    const ssu = event.target;
    this.pendingSsu.delete(ssu);
    const ssuInfo = this.getSsuInfo(ssu);
    if (!ssuInfo) return;
    const start = ssuInfo.start + (event.charIndex || 0);
    const len = Math.max(0, Math.min(event.charLength || Infinity, ssuInfo.end - start));
    if (Number.isInteger(start) && Number.isInteger(len) && start >= 0 && len >= 0) {
      this.page.textPage.highlightChars(start, len);
    } else {
      this.reset();
    }
    this.spoken = start;
    this.readMore();
    if (this.boundaryCursor === boundaryCursor) {
      this.boundaryCursor = null;
    }
  }
  /** @param {SpeechSynthesisEvent} event */
  onEnd(event) {
    if (!this.speaking) return;
    this.speakingSsu = null;
    const ssu = event.target;
    const ssuInfo = this.getSsuInfo(ssu);
    if (!ssuInfo) return;
    if (ssuInfo.end === this.page.content.length) {
      this.stop();
    } else if (!this.page.textPage) {
      this.stop();
    } else {
      this.page.textPage.clearHighlight();
      if (this.pendingSsu && this.pendingSsu.has(ssu)) {
        this.pendingSsu.delete(ssu);
        this.spoken = ssuInfo.end;
        this.readMore();
      }
    }
    ssu.removeEventListener('boundary', this.onBoundary);
    ssu.removeEventListener('end', this.onEnd);
    ssu.removeEventListener('error', this.onError);
  }
  onError(event) {
    this.stop();
  }
  getSsuInfo(ssu) {
    const info = this.ssuInfo.get(ssu);
    if (!info) this.reset();
    return info;
  }
  readNext() {
    const current = this.next;
    const line = this.page.content.indexOf('\n', current) + 1;
    const end = Math.min(line || this.page.content.length, current + this.readBuffer);
    this.next = end;
    const text = this.page.content.slice(current, end).trimRight();
    if (!text) return;
    const ssu = speech.prepare(text);
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
    const size = this.readBuffer;
    while (
      this.speaking &&
      this.next < Math.min(length, this.spoken + size) &&
      this.pendingSsu.size <= this.maxPendingSsuSize
    ) {
      this.readNext();
      await new Promise(resolve => { setTimeout(resolve, 0); });
    }
    this.readMoreBusy = false;
  }
  async start() {
    if (this.lastReset) return;
    if (this.speaking) return;
    if (speechSynthesis.speaking || speechSynthesis.pending) return;
    this.readMoreBusy = false;
    const page = this.page;
    page.element.classList.add('read-speech');
    this.next = page.getCursor();
    if (this.spoken != null && this.page.textPage.isInPage(this.spoken)) {
      this.next = this.spoken;
    }
    this.spoken = this.next;
    this.pendingSsu = new Set();
    this.speaking = true;
    if ('mediaSession' in navigator) {
      this.fakeAudio.currentTime = 0;
      document.removeEventListener('keydown', this.onMediaKey);
      await this.fakeAudio.play();
      navigator.mediaSession.playbackState = 'playing';
    }
    this.readMore();
  }
  async stop() {
    if (!this.speaking) return;
    this.page.element.classList.remove('read-speech');
    this.page.textPage.clearHighlight();
    this.speaking = false;
    this.pendingSsu = null;
    while (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
      this.fakeAudio.pause();
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
    if (this.lastReset) return;
    if (this.speaking) await this.stop();
    else await this.start();
  }
  cursorChange() {
    if (this.speaking || this.lastReset) {
      if (this.boundaryCursor) return;
      this.reset();
    } else {
      this.spoken = null;
    }
  }
  /* global MediaMetadata: false */
  metaLoad(meta) {
    this.stop();
    if (!('mediaSession' in navigator)) return;
    this.fakeAudio = new Audio([
      'data:audio/mp3;base64,',
      'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjgzLjEwMAAAAAAAAAAAAAAA/+M4AAAAA',
      'AAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAANEAADr+AAEBwkLDhATFRgaHCAjJScqLC8xND',
      'Y5PD9BREZIS01QUlVYW11gYmRnaWxucXR3eXx+gYOFiIqNkJOVmJqdn6Kkpqmtr7G0trm',
      '7vsDCxcnLzdDS1dfa3N/h5efq7O7x8/b4+/0AAAAATGF2YzU3LjEwAAAAAAAAAAAAAAAA',
      'JAPAAAAAAAAA6/hWiK+yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      'AAA',
      ('/+MYZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAw' + 'V'.repeat(56)).repeat(336),
    ].join(''));
    this.fakeAudio.loop = true;
    document.body.appendChild(this.fakeAudio);
    navigator.mediaSession.metadata = new MediaMetadata({ title: meta.title });
    navigator.mediaSession.setActionHandler('play', () => { this.start(); });
    navigator.mediaSession.setActionHandler('pause', () => { this.stop(); });
    navigator.mediaSession.setActionHandler('stop', () => { this.stop(); });
    navigator.mediaSession.setPositionState({ duration: 0, playbackRate: 1, position: 0 });
    navigator.mediaSession.playbackState = 'paused';
    document.addEventListener('keydown', this.onMediaKey);
  }
  metaUnload() {
    this.stop();
    if (!('mediaSession' in navigator)) return;
    document.removeEventListener('keydown', this.onMediaKey);
    document.body.removeChild(this.fakeAudio);
    this.fakeAudio = null;
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setPositionState();
  }
  /** @param {KeyboardEvent} event */
  onMediaKey(event) {
    const key = event.key;
    if (key === 'MediaPlayPause') {
      if (this.speaking) this.stop();
      else this.start();
    } else if (key === 'MediaStop') {
      this.stop();
    }
  }
}

