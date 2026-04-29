declare const Spicetify: {
  CosmosAsync?: {
    get<T = unknown>(url: string): Promise<T>;
  };
  LocalStorage?: {
    get(key: string): string | null;
    set(key: string, value: string): void;
  };
  Platform?: {
    History?: {
      location?: {
        pathname?: string;
      };
    };
  };
  Topbar?: {
    Button: new (
      label: string,
      icon: string,
      callback: () => void | Promise<void>,
      disabled?: boolean,
    ) => unknown;
  };
  showNotification?: (message: string, isError?: boolean, ms?: number) => void;
};
