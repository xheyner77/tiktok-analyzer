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
  const isWindows = process.platform === 'win32';
  const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const cacheRoot = process.env.XDG_CACHE_HOME || (isWindows ? path.join(local, 'Cache') : path.join(home, '.cache'));
  const configRoot = process.env.XDG_CONFIG_HOME || (isWindows ? path.join(roaming, 'Config') : path.join(home, '.config'));
  const dataRoot = process.env.XDG_DATA_HOME || (isWindows ? path.join(roaming, 'Data') : path.join(home, '.local', 'share'));
  const stateRoot = process.env.XDG_STATE_HOME || (isWindows ? path.join(local, 'State') : path.join(home, '.local', 'state'));
  const factory = (nextOptions = {}) => createAppPaths(nextOptions);
  const target = (root, optionsValue) => {
    const current = normalizeOptions(optionsValue, isolated);
    return path.join(root, current.isolated ? applicationName : '');
  };

  factory.$name = () => applicationName;
  factory.$isolated = () => isolated;
  factory.cache = (value) => target(cacheRoot, value);
  factory.config = (value) => target(configRoot, value);
  factory.data = (value) => target(dataRoot, value);
  factory.runtime = (value) => process.env.XDG_RUNTIME_DIR
    ? target(process.env.XDG_RUNTIME_DIR, value)
    : undefined;
  factory.state = (value) => target(stateRoot, value);
  factory.configDirs = (value) => {
    if (isWindows) return [factory.config(value)];
    return (process.env.XDG_CONFIG_DIRS || '/etc/xdg')
      .split(path.delimiter)
      .map((root) => target(root, value));
  };
  factory.dataDirs = (value) => {
    if (isWindows) return [factory.data(value)];
    return (process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share')
      .split(path.delimiter)
      .map((root) => target(root, value));
  };

  return factory;
}

module.exports = createAppPaths({ name: 'node' });
