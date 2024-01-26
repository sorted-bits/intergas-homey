import fetch, { Headers } from 'node-fetch'
import { OVERRIDE_MIN_TEMP } from './constants';
import { Heater } from './heater';

const performCommand = async (host: string, path: string, username?: string, password?  : string): Promise<any> => {
     
    const url = username ? `http://${host}/protect/${path}` : `http://${host}/${path}`;

    const headers = new Headers();
    if (username) {
        headers.append('Authorization', 'Basic ' + btoa(`${username}:${password}`));
    }

    const response = await fetch(url, {
        headers: headers,
    });

    const json = await response.json();
    return json;
  }

export const getStatus = async (host: string, heaterIndex: number, username?: string, password?: string): Promise<any> => {
    var path = `data.json?heater=${heaterIndex}`;
    let response = await performCommand(host, path, username, password);
    return response;
}

export const setTemperature = async (host: string, heaterIndex: number, room: number, temperature: number, username?: string, password?: string) : Promise<void> => {
    let path = `data.json?heater=${heaterIndex}`
    path += `&thermostat=${room}`
    path += `&setpoint=${(temperature - OVERRIDE_MIN_TEMP) * 10}`;

    await performCommand(host, path, username, password);
}

export const getHeaterList = async (host: string, username?: string, password?: string): Promise<Heater[]> => {
    let path = 'heaterlist.json';

    const response = await performCommand(host, path, username, password);
    const heaters: Heater[] = (response.heaterlist as string[]).map((heater, index) => {
        return {
            id: heater,
            index,
        };
    });

    return heaters.filter(h => h.id != null);
}