import { BITMASK_BURNER, BITMASK_FAIL, BITMASK_PUMP, BITMASK_TAP, INVALID_VALUE } from "../constants";
import { IntergasResponse } from "./response";

const ioToBool = (io: number, mask: number): boolean => {
    const result = io & mask;
    return Boolean(result);
}

const displayCodeToText = (code: number): string => {
    const displayCodes: { [id: number]: string} = {
      0:'opentherm',
      15:'boiler ext.',
      24:'frost',
      37:'central heating rf',
      51:'tapwater int.',
      85:'sensortest',
      102:'central heating',
      126:'standby',
      153:'postrun boiler',
      170:'service',
      204:'tapwater',
      231:'postrun ch',
      240:'boiler int.',
      255:'buffer',
    }

    return displayCodes[code] ?? 'Unknown';
}

const generateValueWithPrefix = (prefix: string, data: any): number | undefined => {
    const convert = (mostSignificantByte: number, leastSignificantByte: number): number => {
      return (mostSignificantByte * 256 + leastSignificantByte) / 100;
    }

    const result = convert(data[`${prefix}_msb`], data[`${prefix}_lsb`])
    if (result === INVALID_VALUE) return undefined;
    return result;
  }  

export const parseStatus = (data: any | undefined): IntergasResponse | undefined => {
    if (data === undefined) {
        return undefined;
    }
    const IO = data['IO'];
    const displayCode = data['displ_code'];

    const result: IntergasResponse = {
        heating: {
            temperature: generateValueWithPrefix('ch_temp', data),
            pressure: generateValueWithPrefix('ch_pressure', data),
        },
        tap: {
            temperature: generateValueWithPrefix('tap_temp', data),
        },
        room1: {
            override: generateValueWithPrefix(`room_set_ovr_1`, data),
            target: generateValueWithPrefix(`room_temp_set_1`, data),
            temperature: generateValueWithPrefix(`room_temp_1`, data),
        },
        room2: {
            override: generateValueWithPrefix(`room_set_ovr_2`, data),
            target: generateValueWithPrefix(`room_temp_set_2`, data),
            temperature: generateValueWithPrefix(`room_temp_2`, data),
        },
        displayCode: displayCode,
        displayText: displayCodeToText(displayCode),
        isBurning: ioToBool(IO, BITMASK_BURNER),
        isFailing: ioToBool(IO, BITMASK_FAIL),
        isTapping: ioToBool(IO, BITMASK_TAP),
        isPumping: ioToBool(IO, BITMASK_PUMP)
    }

    return result;
}