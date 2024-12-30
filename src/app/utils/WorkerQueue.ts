

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
  id: string;
  data: any;
};

export interface WorkerPostMessage {
  request: RequestObj | ReturnObj;
  workerId: number;
}

export class WorkerQueue <T extends RequestObj> {
  private queue: T[] = [];
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
    if (this.queue.length === 0) return;
    if (!this.workersBusy.includes(false)) return;
    
    const requestObj = this._dequeue();
    if (!requestObj) return;
    if (!requestObj.id) return;
    if (!requestObj.type) return;
    if (!requestObj.data) return;
    
    const workerId = this.workersBusy.indexOf(false);
    this.workersBusy[workerId] = true;
    this.workers[workerId].postMessage({
      request: requestObj,
      workerId: workerId,
    });
  }

  _handleWorkerMessage(e: MessageEvent) {
    const { request , workerId } = e.data as WorkerPostMessage;
    this.workersBusy[workerId] = false;
    this.params.callback(request.data);
  }

  _enqueue(request: T): boolean {
    if (this.queue.find((r) => r.id === request.id)) return false;
    this.queue.push(request);
    return true;
  }

  _dequeue(): T | undefined {
    return this.queue.shift();
  }

  getQueueIds() {
    return this.queue.map((request) => request.id);
  }

  isRequestInQueue(id: string): boolean {
    return this.queue.find((request) => request.id === id) !== undefined;
  }

  addRequest(request: T): boolean {
    return this._enqueue(request);
  }

  removeRequest(id: string): boolean {
    const index = this.queue.findIndex((request) => request.id === id);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
  }
}
