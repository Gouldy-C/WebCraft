

export interface WorkerQueueParams {
  url: URL
  numberOfWorkers: number;
  callback: CallableFunction;
}

export interface WorkerObj {
  id: string;
  type: string;
  data: any;
};

export interface WorkerPostMessage {
  id: string;
  workerId: number;
  request: WorkerObj;
}

export class WorkerQueue <T extends WorkerObj> {
  private queueIds: Set<string> = new Set();
  private queue: Map<string, T> = new Map();
  private params: WorkerQueueParams;
  private workers: Worker[] = [];
  private workersBusy: boolean[] = [];

  constructor(params: WorkerQueueParams) {
    this.params = params;

    for (let i = 0; i < params.numberOfWorkers; i++) {
      const worker = new Worker(
        params.url,
        { type: "module" }
      );
      worker.onmessage = (e) => this._handleWorkerMessage(e);
      worker.onerror = (e) => {
        console.error(e);
      };
      worker.onmessageerror = (e) => {
        console.error(e);
      };
      this.workers.push(worker);
      this.workersBusy.push(false);
    }
  }

  update() {
    if (this.queue.size === 0) return;
    if (!this.workersBusy.includes(false)) return;
    
    for (let i = 0; i < this.params.numberOfWorkers; i++) {
      if (this.workersBusy[i]) continue;
      const requestObj = this._dequeue();
      if (!requestObj) continue;
      if (!requestObj.id) continue;
      if (!requestObj.type) continue;
      if (!requestObj.data) continue;
      
      this.workersBusy[i] = true;
      this.workers[i].postMessage({
        id: requestObj.id,
        workerId: i,
        request: requestObj,
      })
    }
  }

  private _handleWorkerMessage(e: MessageEvent) {
    const { id, request, workerId } = e.data as WorkerPostMessage;
    this.workersBusy[workerId] = false;
    this.queueIds.delete(id);
    this.params.callback(request);
  }

  private _enqueue(request: T): boolean {
    if (this.queueIds.has(request.id)) return false;
    this.queueIds.add(request.id);
    this.queue.set(request.id, request);
    return true;
  }

  private _enqueueFront(request: T): boolean {
    if (this.queueIds.has(request.id)) return false;
    this.queueIds.add(request.id);
    const newQueue = new Map();
    newQueue.set(request.id, request);
    for (const [key, value] of this.queue) {
      newQueue.set(key, value);
    }
    this.queue = newQueue;
    return true;
  }

  private _dequeue(): T | undefined {
    const key = this.queue.keys().next().value;
    if (!key) return undefined;
    const request = this.queue.get(key);
    this.queue.delete(key);
    return request;
  }

  getQueueIds(): Set<string> {
    return new Set(this.queueIds);
  }

  isRequestInQueue(id: string): boolean {
    return this.queueIds.has(id);
  }

  addRequest(request: T): boolean {
    return this._enqueue(request);
  }

  addPriorityRequest(request: T): boolean {
    return this._enqueueFront(request);
  }

  removeRequest(id: string): boolean {
    const idExists = this.queueIds.delete(id);
    const requestExists = this.queue.delete(id);
    return idExists || requestExists;
  }
}
