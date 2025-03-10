import {
  ConfigurationTarget,
  ExtensionContext,
  EventEmitter,
  workspace,
  Memento,
} from 'vscode';
import { Store } from '@nx-console/shared-schema';
import {
  GLOBAL_CONFIG_KEYS,
  GlobalConfigKeys,
  GlobalConfig,
} from './configuration-keys';

let CONFIG_STORE: GlobalConfigurationStore;

export class GlobalConfigurationStore implements Store {
  static configurationSection = 'nxConsole';

  static fromContext(context: ExtensionContext): GlobalConfigurationStore {
    CONFIG_STORE = new GlobalConfigurationStore(context.globalState);
    return CONFIG_STORE;
  }

  static get instance() {
    if (!CONFIG_STORE) {
      throw Error(
        'Please create a configuration store with `fromContext` first'
      );
    }
    return CONFIG_STORE;
  }

  private readonly _onConfigurationChange: EventEmitter<void> =
    new EventEmitter();
  readonly onConfigurationChange = this._onConfigurationChange.event;

  private constructor(private readonly state: Memento) {
    workspace.onDidChangeConfiguration(() => {
      this._onConfigurationChange.fire();
    });
  }

  get<T extends keyof GlobalConfig>(key: T): GlobalConfig[T] | null;
  get<T>(key: GlobalConfigKeys): T | null;
  get<T>(key: GlobalConfigKeys, defaultValue: T): T;
  get<T>(key: GlobalConfigKeys, defaultValue?: T): T | null {
    const value = this.storage(key).get(key, defaultValue);
    return typeof value === 'undefined' ? defaultValue || null : value;
  }

  set<T>(
    key: GlobalConfigKeys,
    value: T,
    configurationTarget?: ConfigurationTarget
  ): void {
    this.storage(key).update(key, value, configurationTarget);
    this._onConfigurationChange.fire();
  }

  delete(key: GlobalConfigKeys): void {
    this.storage(key).update(key, undefined);
    this._onConfigurationChange.fire();
  }

  storage(key: GlobalConfigKeys): VSCState {
    return isConfig(key) ? this.config : this.state;
  }

  get config() {
    return workspace.getConfiguration(
      GlobalConfigurationStore.configurationSection
    );
  }
}

function isConfig(key: GlobalConfigKeys): boolean {
  return GLOBAL_CONFIG_KEYS.includes(key);
}

export interface VSCState {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any, target?: ConfigurationTarget): void;
}
