(function () {
  'use strict';

  const STORAGE_KEY = 'ssiCsTimerConfig';
  const CONTENT_SOURCE = 'ssi-cstimer-extension';
  const PAGE_SOURCE = 'ssi-cstimer-page';
  const pendingContextRequests = new Map();
  let currentContext = null;
  let extensionEnabled = null;

  async function readConfigStore() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return stored[STORAGE_KEY] || { version: 3, enabled: true, sessions: {} };
  }

  async function syncConfigStore() {
    const configStore = await readConfigStore();
    const nextEnabled = configStore.enabled !== false;
    const shouldReload = extensionEnabled === true && !nextEnabled;
    extensionEnabled = nextEnabled;
    window.postMessage({
      source: CONTENT_SOURCE,
      type: 'CONFIG_SYNC',
      payload: configStore,
    }, '*');
    if (shouldReload) window.location.reload();
  }

  function postContextRequest(requestId) {
    window.postMessage({
      source: CONTENT_SOURCE,
      type: 'CONTEXT_REQUEST',
      requestId,
    }, '*');
  }

  function requestContext() {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timeoutId = setTimeout(() => {
        const pending = pendingContextRequests.get(requestId);
        if (pending && pending.retryId != null) clearTimeout(pending.retryId);
        pendingContextRequests.delete(requestId);
        reject(new Error('The csTimer bridge did not respond. Reload the csTimer tab and try again.'));
      }, 2500);

      pendingContextRequests.set(requestId, { resolve, timeoutId, retryId: null });
      postContextRequest(requestId);
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== PAGE_SOURCE) return;

    if (message.type === 'BRIDGE_READY') {
      currentContext = message.payload && message.payload.context;
      syncConfigStore().catch(console.error);
      return;
    }

    if (message.type === 'BRIDGE_LOADING') {
      currentContext = null;
      return;
    }

    if (message.type === 'SESSION_CHANGED') {
      currentContext = message.payload && message.payload.session;
      syncConfigStore().catch(console.error);
      return;
    }

    if (message.type === 'CONTEXT_RESPONSE') {
      const pending = pendingContextRequests.get(message.payload && message.payload.requestId);
      if (!pending) return;
      if (!message.payload.ready) {
        pending.retryId = setTimeout(() => postContextRequest(message.payload.requestId), 100);
        return;
      }
      clearTimeout(pending.timeoutId);
      if (pending.retryId != null) clearTimeout(pending.retryId);
      pendingContextRequests.delete(message.payload.requestId);
      if (message.payload.context) {
        currentContext = message.payload.context;
        syncConfigStore().catch(console.error);
      }
      pending.resolve(message.payload);
      return;
    }

    if (message.type === 'COMMENT_WRITTEN') {
      console.info('[csTimer Auto Algcount]', message.payload.comment);
    } else if (message.type === 'DISPLAY_UPDATED') {
      console.info('[csTimer Auto Algcount]', message.payload.algCount);
    } else if (message.type === 'ERROR') {
      console.warn('[csTimer Auto Algcount]', message.payload.message);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
    syncConfigStore().catch(console.error);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'GET_CONTEXT') return undefined;
    requestContext()
      .then((response) => sendResponse({ ok: true, ...response }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  syncConfigStore().catch(console.error);
})();
