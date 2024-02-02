import fetch from 'node-fetch';
import { setTemperature } from '../api';
import { Logger } from '../log';
import { OVERRIDE_MIN_TEMP } from '../../constants';

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const successObject = {
    nodenr: 75,
    ch_temp_lsb: 139,
    ch_temp_msb: 21,
    tap_temp_lsb: 24,
    tap_temp_msb: 16,
    ch_pressure_lsb: 149,
    ch_pressure_msb: 0,
    room_temp_1_lsb: 14,
    room_temp_1_msb: 7,
    room_temp_set_1_lsb: 164,
    room_temp_set_1_msb: 6,
    room_temp_2_lsb: 255,
    room_temp_2_msb: 127,
    room_temp_set_2_lsb: 255,
    room_temp_set_2_msb: 127,
    displ_code: 126,
    IO: 0,
    serial_year: 20,
    serial_month: 2,
    serial_line: 16,
    serial_sn1: 0,
    serial_sn2: 22,
    serial_sn3: 62,
    room_set_ovr_1_msb: 6,
    room_set_ovr_1_lsb: 164,
    room_set_ovr_2_msb: 0,
    room_set_ovr_2_lsb: 0,
    rf_message_rssi: 33,
    rfstatus_cntr: 0,
};

const USERNAME = 'admin';
const PASSWORD = 'password';
const HOST = '127.0.0.1';
const HEATER_INDEX = 0;
const ROOM = 1;
const TEMPERATURE = 20;

describe('set-temperature', () => {
    test('Succesfully set a new temperature', async () => {
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
            new Response(JSON.stringify(successObject)),
        );

        const result = await setTemperature(new Logger(), HOST, HEATER_INDEX, ROOM, TEMPERATURE, USERNAME, PASSWORD);

        expect(result).toStrictEqual(true);

        const expectedHeaders = {
            Authorization: `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`,
        };

        let path = `data.json?heater=${HEATER_INDEX}`;
        path += `&thermostat=${ROOM}`;
        path += `&setpoint=${(TEMPERATURE - OVERRIDE_MIN_TEMP) * 10}`;

        const host = `http://${HOST}/protect/${path}`;

        expect(fetch).toHaveBeenCalledWith(
            host,
            {
                method: 'GET',
                headers: expectedHeaders,
            },
        );
    });

    test('Failed to set a new temperature', async () => {
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue({});

        const result = await setTemperature(new Logger(), HOST, HEATER_INDEX, ROOM, TEMPERATURE, USERNAME, PASSWORD);

        expect(result).toStrictEqual(false);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});
