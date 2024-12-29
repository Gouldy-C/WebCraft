


export type InventoryItem = {
    name: string;
    id: number;
    amount: number;
}

export class Inventory {
    public static readonly DROP = 'drop';
    public static readonly USE = 'use';
    public static readonly PICKUP = 'pickup';
    

}