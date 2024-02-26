import fetch from 'node-fetch';
import { OVERRIDE_MIN_TEMP } from '../constants';
import { Heater } from '../heater';
import { IntergasData } from './response';
import { CommandResponse, checkResponseData } from './helpers';
import { IBaseLogger } from './log';


const performCommand = async (origin: IBaseLogger, host: string, path: string, username?: string, password?: string, logOutput: boolean = true): Promise<CommandResponse> => {
    const url = username ? `http://${host}/protect/${path}` : `http://${host}/${path}`;

    try {
        const response = username
            ? await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${btoa(`${username}:${password}`)}`,
                },
            })
            : await fetch(url, {
                method: 'GET',
            });

        origin.log('Received response for ', path, response.status, response.statusText);

        if (response.status === 200) {
            const json = await response.json();

            if (logOutput) {
                origin.log('Json response for ', path, json);
            }

            return {
                json,
                status: response.status,
                statusText: response.statusText,
            }
        } else {
            return {
                status: response.status,
                statusText: response.statusText,
            };
        }
    } catch (error) {
        return {
            status: 500,
            statusText: error ? error.toString() : 'Unknown error',
        }
    }
};

export const getStatus = async (origin: IBaseLogger, host: string, heaterIndex: number, username?: string, password?: string): Promise<IntergasData | undefined> => {
    const path = `data.json?heater=${heaterIndex}`;

    const response = await performCommand(origin, host, path, username, password, false);

    if (checkResponseData(response)) {
        return new IntergasData(response.json);
    }

    origin.error('Invalid Intergas data', JSON.stringify(response));
    return undefined;
};

export const setTemperature = async (origin: IBaseLogger, host: string, heaterIndex: number, room: number, temperature: number, username?: string, password?: string): Promise<boolean> => {
    let path = `data.json?heater=${heaterIndex}`;
    path += `&thermostat=${room}`;
    path += `&setpoint=${(temperature - OVERRIDE_MIN_TEMP) * 10}`;

    origin.log('Setting temperature: ', path);

    const response = await performCommand(origin, host, path, username, password, false);
    if (response.status === 200) {
        return true;
    }

    origin.error('setTemperature failed', JSON.stringify(response));

    return false;
};

export const getHeaterList = async (origin: IBaseLogger, host: string, username?: string, password?: string): Promise<Heater[]> => {
    origin.log('Getting heater list', host, username, '********');

    const path = 'heaterlist.json';

    const response = await performCommand(origin, host, path, username, password);

    if (response.status === 200) {
        const heaters: Heater[] = (response.json.heaterlist as string[]).map((heater, index) => {
            return {
                id: heater,
                index,
            };
        });

        return heaters.filter((h) => h.id != null);
    }

    origin.error('getHeaterList faield', JSON.stringify(response));

    throw new Error('Failed to fetch heaters');
};
