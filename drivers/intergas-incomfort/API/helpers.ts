/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    INVALID_VALUE,
} from '../constants';

export interface CommandResponse {
    json?: any;
    status: number;
    statusText?: string;
}


export const ioToBool = (io: number, mask: number): boolean => {
    const result = io & mask;
    return Boolean(result);
};

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
    };

    return displayCodes[code] ?? 'Unknown';
};

export const generateValueWithPrefix = (prefix: string, data: any): number | undefined => {
    const convert = (mostSignificantByte: number, leastSignificantByte: number): number => {
        return (mostSignificantByte * 256 + leastSignificantByte) / 100;
    };

    const msbKey = `${prefix}_msb`;
    const lsbKey = `${prefix}_lsb`;

    if (data[msbKey] !== undefined && data[lsbKey] !== undefined) {
        const result = convert(data[msbKey], data[lsbKey]);
        if (result === INVALID_VALUE) return undefined;
        return result;
    }
    return undefined;
};

const checkWithPrefix = (data: any, prefix: string): boolean => {
    if (data[`${prefix}_msb`] === undefined) {
        return false;
    }
    if (data[`${prefix}_lsb`] === undefined) {
        return false;
    }

    return true;
};

export const checkResponseData = (data: CommandResponse): boolean => {
    if (data === undefined || data.json === undefined || data.status !== 200) {
        return false;
    }

    const json = data.json;

    if (json['displ_code'] === undefined) {
        return false;
    }

    if (!checkWithPrefix(json, 'tap_temp')) {
        return false;
    }

    if (!checkWithPrefix(json, 'ch_temp')) {
        return false;
    }

    if (!checkWithPrefix(json, 'ch_pressure')) {
        return false;
    }

    if (!checkWithPrefix(json, 'room_set_ovr_1')) {
        return false;
    }

    if (!checkWithPrefix(json, 'room_temp_set_1')) {
        return false;
    }

    if (!checkWithPrefix(json, 'room_temp_1')) {
        return false;
    }

    return true;
};
