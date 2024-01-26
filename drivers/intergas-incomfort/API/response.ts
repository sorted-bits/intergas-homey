export interface Room {
    temperature?: number;
    target?: number;
    override?: number;
}

export interface Heating {
    pressure?: number;
    temperature?: number;
}

export interface Tap {
    temperature?: number;
}

export interface IntergasResponse {
    displayCode?: number;
    displayText?: string;

    room1?: Room;
    room2?: Room;

    heating?: Heating;
    tap?: Tap;

    isPumping?: boolean;
    isTapping?: boolean;
    isBurning?: boolean;
    isFailing?: boolean;
}