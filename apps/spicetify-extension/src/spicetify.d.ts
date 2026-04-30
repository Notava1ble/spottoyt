declare const Spicetify: {
  CosmosAsync?: {
    get<T = unknown>(url: string): Promise<T>;
  };
  LocalStorage?: {
    get(key: string): string | null;
    set(key: string, value: string): void;
  };
  ContextMenu?: {
    Item: new (
      label: string,
      callback: (uris: string[]) => void | Promise<void>,
      shouldAdd?: (uris: string[]) => boolean,
      icon?: string,
      disabled?: boolean,
    ) => {
      register(): void;
    };
  };
  Platform?: {
    History?: {
      location?: {
        pathname?: string;
      };
    };
    PlaylistAPI?: {
      getContents(
        uri: string,
        options?: {
          limit?: number;
        },
      ): Promise<{
        items?: unknown;
      }>;
    };
  };
  URI?: {
    fromString(uri: string): {
      type?: string;
    };
    Type: {
      PLAYLIST: string;
      PLAYLIST_V2?: string;
    };
  };
  showNotification?: (message: string, isError?: boolean, ms?: number) => void;
};
