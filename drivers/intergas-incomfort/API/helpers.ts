import { BITMASK_BURNER, BITMASK_FAIL, BITMASK_PUMP, BITMASK_TAP, INVALID_VALUE } from "../constants";

export const ioToBool = (io: number, mask: number): boolean => {
    const result = io & mask;
    return Boolean(result);
}

export const displayCodeToText = (code: number): string => {
    const displayCodes: { [id: number]: string } = {
        0: 'opentherm',
        15: 'boiler ext.',
        24: 'frost',
        37: 'central heating rf',
        51: 'tapwater int.',
        85: 'sensortest',
        102: 'central heating',
        126: 'standby',
        153: 'postrun boiler',
        170: 'service',
        204: 'tapwater',
        231: 'postrun ch',
        240: 'boiler int.',
        255: 'buffer',
    }

    return displayCodes[code] ?? 'Unknown';
}

export const generateValueWithPrefix = (prefix: string, data: any): number | undefined => {
    const convert = (mostSignificantByte: number, leastSignificantByte: number): number => {
        return (mostSignificantByte * 256 + leastSignificantByte) / 100;
    }

    const msbKey = `${prefix}_msb`;
    const lsbKey = `${prefix}_lsb`

    if (data[msbKey] !== undefined && data[lsbKey] !== undefined) {
        const result = convert(data[msbKey], data[lsbKey])
        if (result === INVALID_VALUE) return undefined;
        return result;
    }
    return undefined;
}

const checkWithPrefix = (data: any, prefix: string) : boolean => {
    if (data[`${prefix}_msb`] === undefined) {
        return false;
    }
    if (data[`${prefix}_lsb`] === undefined) {
        return false;
    }

    return true;
}

export const checkResponseData = (data: any): boolean => {
    if (data === undefined) {
        return false;
    }

    if (data['displ_code'] === undefined) {
        return false;
    }

    if (!checkWithPrefix(data, 'tap_temp')) {
        return false;
    }

    if (!checkWithPrefix(data, 'ch_temp')) {
        return false;
    }

    if (!checkWithPrefix(data, 'ch_pressure')) {
        return false;
    }

    if (!checkWithPrefix(data, 'room_set_ovr_1')) {
        return false;
    }

    if (!checkWithPrefix(data, 'room_temp_set_1')) {
        return false;
    }
    
    if (!checkWithPrefix(data, 'room_temp_1')) {
        return false;
    }
    
    return true;
}
