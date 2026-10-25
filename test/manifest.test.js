import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../gladys-assistant-integration.json', import.meta.url)),
    'utf8',
  ),
);

// The four languages of the Gladys interface.
const LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * Collect every localized object of the manifest (any object carrying `en`).
 * @param {any} node - Part of the manifest to walk.
 * @param {string} path - Where `node` sits, for the assertion message.
 * @returns {Array<{ path: string, value: object }>} The localized objects.
 * @example
 * localizedObjects(manifest, 'manifest');
 */
function localizedObjects(node, path) {
  if (!node || typeof node !== 'object') {
    return [];
  }
  if (!Array.isArray(node) && typeof node.en === 'string') {
    return [{ path, value: node }];
  }
  return Object.entries(node).flatMap(([key, child]) => localizedObjects(child, `${path}.${key}`));
}

test('manifest declares a send-only communication integration', () => {
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'communication');
  assert.deepEqual(manifest.messaging, { receive: false });
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
  assert.ok(manifest.gladys_version.startsWith('>='));
});

test('the contact schema carries the two required credentials', () => {
  const fields = manifest.contact_schema.filter((field) => field.type !== 'section');
  assert.deepEqual(
    fields.map((field) => [field.key, field.type, field.required]),
    [
      ['username', 'string', true],
      ['access_token', 'secret', true],
    ],
  );
});

test('every link of the manifest uses https', () => {
  manifest.contact_schema
    .flatMap((field) => field.links || [])
    .forEach((link) => assert.match(link.url, /^https:\/\//));
});

test('every manifest text is translated in the four Gladys languages', () => {
  const texts = localizedObjects(manifest, 'manifest');
  assert.ok(texts.length > 0);
  texts.forEach(({ path, value }) => {
    LANGUAGES.forEach((lang) => {
      assert.ok(
        typeof value[lang] === 'string' && value[lang].trim().length > 0,
        `${path} lacks "${lang}"`,
      );
    });
  });
});

test('section descriptions stay within the 1000 characters the core accepts', () => {
  manifest.contact_schema
    .filter((field) => field.type === 'section')
    .forEach((section) =>
      Object.values(section.description).forEach((text) => assert.ok(text.length <= 1000)),
    );
});

test('catalog keywords and countries of Gladys 5.3.0', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  const keywords = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.ok(keywords.length >= 1 && keywords.length <= 10, 'one to ten keywords');
  keywords.forEach((keyword) => assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword));
  assert.equal(new Set(keywords).size, keywords.length, 'unique once trimmed and lowercased');
  // Usable in FR only: hidden from the browse views of the catalog elsewhere.
  assert.deepEqual(manifest.countries, ['FR']);
});
