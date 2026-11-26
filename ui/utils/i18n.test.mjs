import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { I18n } from './i18n.js';

const preferenceKey = 'ruview-locale';
let saved;

function browserLanguage(language) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language },
  });
}

beforeEach(() => {
  browserLanguage('en-US');
  saved = new Map();
  globalThis.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  };
});

test('recognizes Simplified Chinese preferences and retains the other locales', () => {
  for (const language of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN']) {
    browserLanguage(language);
    assert.equal(new I18n().locale, 'zh-CN', language);
  }
  for (const language of ['zh-TW', 'zh-Hant-HK', 'fr-FR']) {
    browserLanguage(language);
    assert.equal(new I18n().locale, 'en', language);
  }
  browserLanguage('pl-PL');
  assert.equal(new I18n().locale, 'pl');
});

test('a supported saved language overrides the browser preference', () => {
  browserLanguage('zh-CN');
  saved.set(preferenceKey, 'en');
  assert.equal(new I18n().locale, 'en');
  for (const value of ['fr', 'constructor', '']) {
    saved.set(preferenceKey, value);
    assert.equal(new I18n().locale, 'zh-CN');
  }
});

test('switching language translates the document and leaves other settings intact', () => {
  const title = { dataset: { i18n: 'nav.dashboard' }, textContent: '' };
  const optionGroup = {
    getAttribute: () => 'misc.language',
    setAttribute(name, value) { this[name] = value; },
  };
  globalThis.document = {
    documentElement: { lang: '' },
    getElementById: () => null,
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return [title];
      if (selector === '[data-i18n-label]') return [optionGroup];
      return [];
    },
  };
  saved.set('ruview-api-token', 'test-placeholder');
  const i18n = new I18n();
  const changes = [];
  i18n.onLocaleChange(locale => changes.push(locale));
  i18n.setLocale('zh-CN');
  assert.equal(document.documentElement.lang, 'zh-CN');
  assert.equal(title.textContent, '控制台');
  assert.equal(optionGroup.label, '语言');
  assert.equal(new I18n().locale, 'zh-CN');
  assert.equal(saved.get('ruview-api-token'), 'test-placeholder');
  i18n.setLocale('en');
  assert.equal(title.textContent, 'Dashboard');
  assert.equal(optionGroup.label, 'Language');
  i18n.setLocale('unsupported');
  assert.deepEqual(changes, ['zh-CN', 'en']);
});

test('registered page messages interpolate values and fall back to English', () => {
  browserLanguage('zh-CN');
  const i18n = new I18n();
  i18n.registerTranslations({
    en: { 'example.summary': 'Node {node}', 'example.hint': 'Settings' },
    'zh-CN': { 'example.summary': '节点 {node}' },
  });
  assert.equal(i18n.t('example.summary', { node: 3 }), '节点 3');
  assert.equal(i18n.t('example.hint'), 'Settings');
  assert.equal(i18n.t('example.absent'), 'example.absent');
});
