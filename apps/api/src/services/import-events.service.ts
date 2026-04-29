import type { ImportEvent } from "@spottoyt/shared";

type ImportEventListener = (event: ImportEvent) => void;

export class ImportEventsService {
  private readonly listeners = new Set<ImportEventListener>();

  subscribe(listener: ImportEventListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: ImportEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
