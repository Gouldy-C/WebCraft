

export interface Params {
  url: URL
  numberOfWorkers: number;
  callback: CallableFunction;
}

export interface RequestObj {
  id: string;
  type: string;
  data: any;
};

export interface ReturnObj {
  data: any;
};

export interface WorkerPostMessage {
  id: string;
  request: RequestObj | ReturnObj;
  workerId: number;
}

export class WorkerQueue <T extends RequestObj> {
  private queueIds: Set<string> = new Set();
  private queue: Map<string, T> = new Map();
  private params: Params;
  private workers: Worker[] = [];
  private workersBusy: boolean[] = [];

  constructor(params: Params) {
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
    
    const requestObj = this._dequeue();
    if (!requestObj) return;
    if (!requestObj.id) return;
    if (!requestObj.type) return;
    if (!requestObj.data) return;
    
    const workerId = this.workersBusy.indexOf(false);
    this.workersBusy[workerId] = true;
    this.workers[workerId].postMessage({
      id: requestObj.id,
      request: requestObj,
      workerId: workerId,
    });
  }

  private _handleWorkerMessage(e: MessageEvent) {
    const { id, request, workerId } = e.data as WorkerPostMessage;
    this.workersBusy[workerId] = false;
    this.params.callback(request.data);
    this.queueIds.delete(id);
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

  getQueueIds() {
    return this.queueIds
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
    return idExists && requestExists;
  }
}
