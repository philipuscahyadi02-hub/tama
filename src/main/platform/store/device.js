// @ts-check
// device.json (this PC only, D-011) held in memory with one writer, so concurrent patches
// from different modules can't overwrite each other with stale copies.

/** @param {import('./index').Store} store */
function createDeviceSettings(store) {
  /** @type {Record<string, any>} */
  let data = store.read('device.json', 'device', () => ({}));

  return {
    /** @returns {Record<string, any>} */
    get: () => data,
    /**
     * Shallow-merge `patch` into a section (or the root when section is null), then save soon.
     * @param {string | null} section @param {Record<string, any>} patch
     */
    patch(section, patch) {
      data = section ? { ...data, [section]: { ...(data[section] || {}), ...patch } } : { ...data, ...patch };
      store.writeSoon('device.json', 'device', () => data, 1000);
    },
  };
}

/** @typedef {ReturnType<typeof createDeviceSettings>} DeviceSettings */

module.exports = { createDeviceSettings };
