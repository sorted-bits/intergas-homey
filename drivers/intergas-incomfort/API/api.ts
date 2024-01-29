import fetch, { Headers } from 'node-fetch';
import { SimpleClass } from 'homey';
import { OVERRIDE_MIN_TEMP } from '../constants';
import { Heater } from '../heater';
import { IntergasData } from './response';
import { checkResponseData } from './helpers';

const performCommand = async (origin: SimpleClass, host: string, path: string, username?: string, password?: string): Promise<any> => {
    const url = username ? `http://${host}/protect/${path}` : `http://${host}/${path}`;

    const headers = new Headers();
    if (username) {
        headers.append('Authorization', `Basic ${btoa(`${username}:${password}`)}`);
    }

    origin.log('Querying Intergas gateway: ', url);

    const response = await fetch(url, {
        headers,
    });

    const json = await response.json();
    return json;
};

export const getStatus = async (origin: SimpleClass, host: string, heaterIndex: number, username?: string, password?: string): Promise<IntergasData | undefined> => {
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

export const setTemperature = async (origin: SimpleClass, host: string, heaterIndex: number, room: number, temperature: number, username?: string, password?: string): Promise<void> => {
    let path = `data.json?heater=${heaterIndex}`;
    path += `&thermostat=${room}`;
    path += `&setpoint=${(temperature - OVERRIDE_MIN_TEMP) * 10}`;

    try {
        await performCommand(origin, host, path, username, password);
    } catch (ex) {
        origin.error('setTemperature failed', ex);
    }
};

export const getHeaterList = async (origin: SimpleClass, host: string, username?: string, password?: string): Promise<Heater[]> => {
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
