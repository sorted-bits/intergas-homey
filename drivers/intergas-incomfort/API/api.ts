import fetch from 'node-fetch';
import { OVERRIDE_MIN_TEMP } from '../constants';
import { Heater } from '../heater';
import { IntergasData } from './response';
import { checkResponseData } from './helpers';
import { IBaseLogger } from './log';

const performCommand = async (origin: IBaseLogger, host: string, path: string, username?: string, password?: string): Promise<any> => {
    const url = username ? `http://${host}/protect/${path}` : `http://${host}/${path}`;

    const headers = username ? {
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    } : undefined;

    origin.log('Querying Intergas gateway: ', url);

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    const json = await response.json();
    return json;
};

export const getStatus = async (origin: IBaseLogger, host: string, heaterIndex: number, username?: string, password?: string): Promise<IntergasData | undefined> => {
    const path = `data.json?heater=${heaterIndex}`;

    try {
        const response = await performCommand(origin, host, path, username, password);

        if (checkResponseData(response)) {
            return new IntergasData(response);
        }
        origin.error('Invalid Intergas data', response);
    } catch (ex) {
        origin.error('getStatus query failed', ex);
    }

    return undefined;
};

export const setTemperature = async (origin: IBaseLogger, host: string, heaterIndex: number, room: number, temperature: number, username?: string, password?: string): Promise<boolean> => {
    let path = `data.json?heater=${heaterIndex}`;
    path += `&thermostat=${room}`;
    path += `&setpoint=${(temperature - OVERRIDE_MIN_TEMP) * 10}`;

    origin.log('Setting temperature: ', path);

    try {
        await performCommand(origin, host, path, username, password);
        return true;
    } catch (ex) {
        origin.error('setTemperature failed', ex);
        return false;
    }
};

export const getHeaterList = async (origin: IBaseLogger, host: string, username?: string, password?: string): Promise<Heater[]> => {
    const path = 'heaterlist.json';

    try {
        const response = await performCommand(origin, host, path, username, password);
        const heaters: Heater[] = (response.heaterlist as string[]).map((heater, index) => {
            return {
                id: heater,
                index,
            };
        });

        return heaters.filter((h) => h.id != null);
    } catch (ex) {
        origin.error('getHeaterList failed', ex);
        throw ex;
    }
};
