const listeners = new Set();
let eventSource = null;

export function onSse(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function startSse() {
  if (eventSource || !window.EventSource) return;
  eventSource = new EventSource("/events");
  eventSource.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (error) {
      return;
    }
    if (!data || !data.type) return;
    listeners.forEach((handler) => handler(data));
  };
}

export function stopSse() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
