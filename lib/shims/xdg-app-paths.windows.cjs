'use strict';

const os = require('node:os');
const path = require('node:path');

function normalizeOptions(options, isolated) {
  const normalized = typeof options === 'object' && options !== null
    ? options
    : { isolated: options };
  const value = normalized.isolated == null ? isolated : normalized.isolated;
  if (typeof value !== 'boolean') {
    throw new TypeError(`Expected boolean for "isolated" argument, got ${typeof value}`);
  }
  return { isolated: value };
}

function createAppPaths(options = {}) {
  const normalized = typeof options === 'object' && options !== null ? options : { name: options };
  const name = normalized.name || 'node';
  const isolated = normalized.isolated == null ? true : normalized.isolated;
  const suffix = normalized.suffix || '';

  if (typeof name !== 'string' || typeof suffix !== 'string' || typeof isolated !== 'boolean') {
    throw new TypeError('Invalid xdg-app-paths options.');
  }

  const applicationName = `${name}${suffix}`;
  const home = os.homedir() || os.tmpdir();
  const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const factory = (nextOptions = {}) => createAppPaths(nextOptions);
  const target = (root, optionsValue, leaf) => {
    const current = normalizeOptions(optionsValue, isolated);
    return path.join(root, current.isolated ? applicationName : '', leaf || '');
  };

  factory.$name = () => applicationName;
  factory.$isolated = () => isolated;
  factory.cache = (value) => target(local, value, 'Cache');
  factory.config = (value) => target(roaming, value, 'Config');
  factory.data = (value) => target(roaming, value, 'Data');
  factory.runtime = () => undefined;
  factory.state = (value) => target(local, value, 'State');
  factory.configDirs = (value) => [factory.config(value)];
  factory.dataDirs = (value) => [factory.data(value)];

  return factory;
}

module.exports = createAppPaths({ name: 'node' });
