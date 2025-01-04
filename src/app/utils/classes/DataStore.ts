export interface Store {
  [key: string]: any
}

export type StoreEvent<T> = {
  type: 'update' | 'clear' | 'reset' | 'delete';
  path?: string[] | Array<keyof T>;
  value?: any;
  previousValue?: any;
  timestamp: number;
}

export type StoreObserver<T> = (event: StoreEvent<T>) => void;

export type Transaction<T> = {
  operations: Array<{
    type: 'set' | 'delete';
    path: string[] | Array<keyof T>;
    value?: any;
  }>;
  timestamp: number;
}

export class DataStore<T> {
  private data: T;
  private defaultStore: T;
  private observers: Set<StoreObserver<T>> = new Set();
  private isTransaction = false;
  private transactions: Transaction<T>[] = [];
  private dataStates: T[] = [];
  private currentTransaction: Transaction<T> | null = null;

  constructor(initialData: T) {
    this.defaultStore = this.deepClone(initialData);
    this.data = this.deepClone(initialData);
  }

  private deepClone<U>(obj: U): U {
    return JSON.parse(JSON.stringify(obj));
  }

  get<K extends keyof T>(keyOrPath: K | string[]): T[K] | any {
    if (Array.isArray(keyOrPath)) {
      const current = this.getByPath(keyOrPath);
      if (current === undefined) {
        return undefined;
      }
      return this.deepClone(current);
    }
    return this.deepClone(this.data[keyOrPath]);
  }

  private getByPath<K extends keyof T>(path: string[] | Array<K>): any {
    if (path.length === 0) {
      throw new Error('Path cannot be empty');
    }

    let current: any = this.data;
    for (const key of path){
      if (!(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    return current
  }

  set<K extends keyof T>(keyOrPath: K | string[], value: T[K] | any): void {
    const path = Array.isArray(keyOrPath) ? keyOrPath : [keyOrPath];
    const oldValue = this.getByPath(path);
    
    this.setByPath(path, this.deepClone(value));

    if (this.isTransaction && this.currentTransaction) {
      this.currentTransaction.operations.push({
        type: 'set',
        path,
        value: this.deepClone(value)
      });
    } else if (!this.isTransaction) {
      this.notifyObservers({
        type: 'update',
        path,
        value,
        previousValue: oldValue,
        timestamp: Date.now()
      });
    }
  }
  
  private setByPath<K extends keyof T>(path: string[] | Array<K>, value: any): void {
    if (!this.currentTransaction?.operations.length) {
      this.dataStates.push(this.deepClone(this.data));
    }
    let current: any = this.data;
    const lastKey = path[path.length - 1];
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    current[lastKey] = value;
  }

  delete<K extends keyof T>(keyOrPath: K | string[]): void {
    const path = Array.isArray(keyOrPath) ? keyOrPath : [keyOrPath];
    const oldValue = this.getByPath(path);

    this.setByPath(path, undefined);

    if (this.isTransaction && this.currentTransaction) {
      this.currentTransaction.operations.push({
        type: 'delete',
        path
      });
    } else if (!this.isTransaction) {
      this.setByPath(path, undefined);
      this.notifyObservers({
        type: 'delete',
        path,
        value: undefined,
        previousValue: oldValue,
        timestamp: Date.now()
      });
    }
  }

  beginTransaction(): void {
    if (this.isTransaction) {
      throw new Error('Transaction already in progress');
    }
    
    this.isTransaction = true;
    this.dataStates.push(this.deepClone(this.data));
    this.currentTransaction = {
      operations: [],
      timestamp: Date.now()
    };
  }

  commitTransaction(): void {
    if (!this.isTransaction || !this.currentTransaction) {
      throw new Error('No transaction in progress');
    }

    try {
      for (const operation of this.currentTransaction.operations) {
        switch (operation.type) {
          case 'set':
            this.setByPath(operation.path, operation.value);
            break;
          case 'delete':
            
            break;
          default:
            throw new Error(`Unknown operation type: ${(operation as any).type}`);
        }
      }

      this.transactions.push(this.currentTransaction);
      this.isTransaction = false;
      this.currentTransaction = null;
      
      this.notifyObservers({
        type: 'update',
        timestamp: Date.now()
      });
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  rollback(): void {
    if (!this.isTransaction && this.dataStates.length === 0) {
      throw new Error('No previous state to rollback to');
    }

    const previousState = this.dataStates.pop();
    if (!previousState) {
      throw new Error('No previous state to rollback to');
    }

    this.data = previousState;
    this.isTransaction = false;
    this.currentTransaction = null;

    this.notifyObservers({
      type: 'reset',
      timestamp: Date.now()
    });
  }

  getHistory(): T[] {
    return this.deepClone(this.dataStates);
  }

  getTransactionHistory(): Transaction<T>[] {
    return this.deepClone(this.transactions);
  }

  clear(): void {
    this.data = this.deepClone(this.defaultStore);
    this.notifyObservers({
      type: 'clear',
      timestamp: Date.now()
    });
  }

  subscribe(observer: StoreObserver<T>): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  private notifyObservers(event: StoreEvent<T>): void {
    this.observers.forEach(observer => observer(event));
  }

  getStore(): T {
    return this.deepClone(this.data);
  }

  hydrate(data: Partial<T>): void {
    this.data = { ...this.deepClone(this.data), ...this.deepClone(data) };
    this.notifyObservers({
      type: 'update',
      timestamp: Date.now()
    });
  }
}