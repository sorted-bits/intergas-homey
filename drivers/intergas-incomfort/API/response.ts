import {
 BITMASK_BURNER, BITMASK_FAIL, BITMASK_PUMP, BITMASK_TAP,
} from '../constants';
import { displayCodeToText, generateValueWithPrefix, ioToBool } from './helpers';

export interface Room {
    temperature: number;
    target: number;
    override: number;
}

export interface Heating {
    pressure: number;
    temperature: number;
}

export interface Tap {
    temperature: number;
}

export class IntergasData {

    displayCode: number;
    displayText: string;

    room1: Room;
    room2?: Room;

    heating: Heating;
    tap: Tap;

    isPumping: boolean;
    isTapping: boolean;
    isBurning: boolean;
    isFailing: boolean;

    constructor(jsonData: any) {
        if (jsonData === undefined) {
            throw new Error('jsonData should not be undefined!');
        }

        this.displayCode = jsonData['displ_code'] ?? 999;
        this.displayText = displayCodeToText(this.displayCode);
        const IO = jsonData['IO'] ?? 0;

        this.tap = {
            temperature: generateValueWithPrefix('tap_temp', jsonData) ?? 0,
        };

        this.heating = {
            temperature: generateValueWithPrefix('ch_temp', jsonData) ?? 0,
            pressure: generateValueWithPrefix('ch_pressure', jsonData) ?? -1,
        };

        this.room1 = {
            override: generateValueWithPrefix('room_set_ovr_1', jsonData) ?? 0,
            target: generateValueWithPrefix('room_temp_set_1', jsonData) ?? 0,
            temperature: generateValueWithPrefix('room_temp_1', jsonData) ?? 0,
        };

        this.isBurning = ioToBool(IO, BITMASK_BURNER);
        this.isFailing = ioToBool(IO, BITMASK_FAIL);
        this.isTapping = ioToBool(IO, BITMASK_TAP);
        this.isPumping = ioToBool(IO, BITMASK_PUMP);
    }

}
