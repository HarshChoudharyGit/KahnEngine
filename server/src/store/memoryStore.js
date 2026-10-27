class TelemetryStore {
  constructor() {
    this.telemetrySubscribers = new Map();
    this.terminalEvents = new Map(); // executionId -> { eventType, data }
  }

  addSubscriber(executionId, reply) {
    if (!this.telemetrySubscribers.has(executionId)) {
      this.telemetrySubscribers.set(executionId, new Set());
    }
    this.telemetrySubscribers.get(executionId).add(reply);

    // If execution has already concluded with a terminal event, replay it immediately
    const terminal = this.terminalEvents.get(executionId);
    if (terminal) {
      try {
        const payload = `event: ${terminal.eventType}\ndata: ${JSON.stringify(terminal.data)}\n\n`;
        reply.raw.write(payload);
      } catch {
        this.removeSubscriber(executionId, reply);
      }
    }
  }

  removeSubscriber(executionId, reply) {
    const subscribers = this.telemetrySubscribers.get(executionId);
    if (!subscribers) return;
    subscribers.delete(reply);
    if (subscribers.size === 0) this.telemetrySubscribers.delete(executionId);
  }

  broadcastTelemetry(executionId, eventType, data) {
    if (eventType === 'execution_completed' || eventType === 'execution_failed') {
      this.terminalEvents.set(executionId, { eventType, data });
      if (this.terminalEvents.size > 500) {
        const oldestKey = this.terminalEvents.keys().next().value;
        this.terminalEvents.delete(oldestKey);
      }
    }

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
