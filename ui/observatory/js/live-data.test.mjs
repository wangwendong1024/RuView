import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visiblePersons } from './live-data.js';
import { HudController } from './hud-controller.js';
import { i18n } from '../../utils/i18n.js';

test('live figures require positive, finite keypoint confidence; demo figures remain illustrative', () => {
  const unmeasured = [
    null, { id: 1 }, { id: 2, keypoints: [] },
    { id: 3, keypoints: [{ confidence: 0 }, { confidence: 0 }] },
    { id: 4, keypoints: [{ confidence: NaN }, { confidence: -1 }] },
  ];
  const measured = { id: 5, keypoints: [{ confidence: 0.8 }] };
  const data = { persons: [...unmeasured, measured] };
  assert.deepEqual(visiblePersons(data, true), [measured]);
  assert.equal(visiblePersons(data, false), data.persons);
  assert.deepEqual(visiblePersons(null, true), []);
});

for (const [locale, badge, moving, absent] of [
  ['en', 'VITALS', 'Live measurements: present moving', 'Live measurements: absent'],
  ['zh-CN', '生命体征', '实时测量：有人移动', '实时测量：无人'],
]) {
  test(`live HUD uses localized classification and clears demo module badges (${locale})`, t => {
    const elements = new Map();
    for (const id of ['scenario-description', 'edge-modules-bar', 'scenario-quick-select', 'autoplay-icon']) {
      elements.set(id, { textContent: '', innerHTML: '', style: {}, value: '' });
    }
    const previousDocument = globalThis.document;
    const previousLocale = i18n.locale;
    globalThis.document = {
      documentElement: {},
      getElementById: id => elements.get(id) || null,
      querySelectorAll: () => [],
    };
    t.after(() => {
      i18n.setLocale(previousLocale);
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    });
    i18n.setLocale(locale);
    const obs = { settings: { dataSource: 'demo' } };
    const hud = new HudController(obs);
    const demo = { _autoMode: false, currentScenario: 'single_breathing' };
    hud.updateHUD({ classification: { motion_level: 'absent' } }, demo);
    const demoCaption = elements.get('scenario-description').textContent;
    assert.ok(elements.get('edge-modules-bar').innerHTML.includes(badge));
    obs.settings.dataSource = 'ws';
    hud.updateHUD({ classification: { motion_level: 'present_moving' } }, demo);
    assert.equal(elements.get('scenario-description').textContent, moving);
    assert.equal(elements.get('edge-modules-bar').style.display, 'none');
    assert.equal(elements.get('edge-modules-bar').innerHTML, '');
    assert.equal(elements.get('scenario-quick-select').disabled, true);
    hud.updateHUD({ classification: { motion_level: 'absent' } }, demo);
    assert.equal(elements.get('scenario-description').textContent, absent);
    obs.settings.dataSource = 'demo';
    hud.updateHUD({}, demo);
    assert.equal(elements.get('scenario-quick-select').disabled, false);
    assert.equal(elements.get('scenario-description').textContent, demoCaption);
  });
}
