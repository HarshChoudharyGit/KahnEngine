class TelemetryStore {
  constructor() {
    this.telemetrySubscribers = new Map();
  }

  addSubscriber(executionId, reply) {
    if (!this.telemetrySubscribers.has(executionId)) {
      this.telemetrySubscribers.set(executionId, new Set());
    }
    this.telemetrySubscribers.get(executionId).add(reply);
  }

  removeSubscriber(executionId, reply) {
    const subscribers = this.telemetrySubscribers.get(executionId);
    if (!subscribers) return;
    subscribers.delete(reply);
    if (subscribers.size === 0) this.telemetrySubscribers.delete(executionId);
  }

  broadcastTelemetry(executionId, eventType, data) {
    const subscribers = this.telemetrySubscribers.get(executionId);
    if (!subscribers) return;

    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const reply of subscribers) {
      try {
        reply.raw.write(payload);
      } catch {
        subscribers.delete(reply);
      }
    }
  }
}

export const memoryStore = new TelemetryStore();
