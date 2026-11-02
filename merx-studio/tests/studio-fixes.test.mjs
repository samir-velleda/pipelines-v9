import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEVICE_FPS_MAX,
  DEVICE_FPS_MIN,
  buildExecutableSpec,
  buildTestPayload,
  clampTargetFps,
  createProject,
  displayStatus,
  interpretPrompt,
  loginArrival,
  nextProjectStatus,
  showDwellField,
  triggerKey,
  validateProject,
} from '../assets/domain.js';
import { LOCALES, setLocale, t } from '../assets/i18n.js';

const NEW_KEYS = ['config.fps', 'config.fpsHint', 'config.dwell', 'config.dwellHint', 'rule.whenPresence', 'rule.whenLine', 'rule.whenDwell', 'toast.signedIn'];
const VENDOR = /hailo|raspberry|npu/i;

function pendingProject(templateId = 'line-crossing') {
  const project = createProject({ name: 'Contagem da loja', templateId });
  project.status = 'submitted';
  project.submission = { id: 'sub-1', status: 'submitted' };
  return project;
}

test('new projects default to the device maximum frame rate and keep a lower saved rate', () => {
  const presence = createProject({ name: 'Presença', templateId: 'presence-zone' });
  const line = createProject({ name: 'Contagem da loja', templateId: 'line-crossing' });
  assert.equal(presence.configuration.targetFps, 10);
  assert.equal(line.configuration.targetFps, DEVICE_FPS_MAX);
  assert.equal(validateProject(presence).valid, true);
  line.configuration.targetFps = 5;
  assert.equal(validateProject(line).valid, true);
  assert.equal(buildTestPayload(line, { deviceId: 'd1', cameraId: 'c1' }).fps, 5);
});

test('frame rate input domain is 1–10 and the device payload is clamped', () => {
  const project = createProject({ name: 'Presença', templateId: 'presence-zone' });
  for (const fps of [1, 10]) {
    project.configuration.targetFps = fps;
    assert.equal(validateProject(project).errors.some(error => /FPS/.test(error)), false);
  }
  for (const fps of [0, 11, 30]) {
    project.configuration.targetFps = fps;
    const result = validateProject(project);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /1 a 10 FPS/);
  }
  project.configuration.targetFps = 30;
  assert.equal(clampTargetFps(30), 10);
  assert.equal(buildExecutableSpec(project).device.fps, DEVICE_FPS_MAX);
  const missing = createProject({ name: 'Presença', templateId: 'presence-zone' });
  delete missing.configuration.targetFps;
  assert.equal(buildExecutableSpec(missing).device.fps, 10);
  const sent = buildTestPayload(project, { deviceId: 'dev', cameraId: 'cam' });
  assert.equal(sent.fps, 10);
  assert.equal(sent.project.configuration.targetFps, 10);
  assert.equal(sent.deviceId, 'dev');
  assert.equal(sent.cameraId, 'cam');
  assert.equal(DEVICE_FPS_MIN, 1);
});

test('project badge follows the latest submission, and geometry edits do not revert a pending review', () => {
  const project = pendingProject();
  project.status = 'draft';
  assert.equal(displayStatus(project), 'submitted');
  project.submission.status = 'approved';
  assert.equal(displayStatus(project), 'approved');
  project.submission.status = 'rejected';
  assert.equal(displayStatus(project), 'rejected');
  project.submission.status = 'submitted';
  project.status = 'submitted';
  assert.equal(nextProjectStatus(project, { geometry: true }), 'submitted');
  assert.equal(nextProjectStatus(project, { geometry: false }), 'draft');
  const moved = interpretPrompt(project, 'linha horizontal');
  assert.equal(moved.project.status, 'submitted');
  assert.equal(displayStatus(moved.project), 'submitted');
  assert.equal(moved.project.configuration.line.start.y, 0.5);
});

test('line crossing uses a crossing trigger and hides dwell', () => {
  assert.equal(showDwellField('line_crossing'), false);
  assert.equal(showDwellField('dwell'), true);
  assert.equal(showDwellField('presence'), true);
  assert.equal(triggerKey('line_crossing'), 'rule.whenLine');
  assert.equal(triggerKey('presence'), 'rule.whenPresence');
  assert.equal(triggerKey('dwell'), 'rule.whenDwell');
  setLocale('pt');
  assert.equal(t(triggerKey('line_crossing')), 'Ao cruzar a linha');
  assert.notEqual(t(triggerKey('line_crossing')), t('rule.whenPresence'));
  setLocale('en');
  assert.equal(t('rule.whenLine'), 'When the line is crossed');
  setLocale('es');
  assert.equal(t('rule.whenLine'), 'Al cruzar la línea');
  setLocale('pt');
});

test('new strings exist in Portuguese, English and Spanish without vendor names', () => {
  for (const locale of ['pt', 'en', 'es']) {
    for (const key of NEW_KEYS) {
      const value = LOCALES[locale][key];
      assert.equal(typeof value, 'string', `${locale} ${key}`);
      assert.notEqual(value.trim(), '');
      assert.equal(VENDOR.test(value), false, value);
    }
    assert.match(LOCALES[locale]['config.fpsHint'], /10/);
  }
});

test('login waits for the license and always loads account projects', () => {
  const active = loginArrival({ licenseLoaded: true, licenseActive: true });
  assert.equal(active.loadAccountProjects, true);
  assert.equal(active.showLicenseToast, false);
  assert.equal(active.openLicense, false);
  const unknown = loginArrival({ licenseLoaded: false, licenseActive: false });
  assert.equal(unknown.showLicenseToast, false);
  const inactive = loginArrival({ licenseLoaded: true, licenseActive: false });
  assert.equal(inactive.showLicenseToast, true);
  assert.equal(inactive.openLicense, true);
  const source = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const waited = source.indexOf('await licensePromise');
  const decision = source.indexOf('loginArrival(');
  assert.ok(waited !== -1 && decision !== -1 && waited < decision);
  assert.ok(source.includes('loadCloudProjects({quiet:true})'));
  assert.equal(source.includes('refreshLicense().then'), false);
  assert.match(source, /name="targetFps" min="1" max="10"/);
  assert.match(source, /data-dwell-field/);
  assert.match(source, /touch\(project,\{geometry:true\}\)/);
  assert.match(source, /fps:spec\.fps/);
});
