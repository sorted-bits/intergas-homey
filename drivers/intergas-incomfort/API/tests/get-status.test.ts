import fetch from 'node-fetch';
import { getStatus } from '../api';
import { Logger } from '../log';

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const USERNAME = 'admin';
const PASSWORD = 'password';
const HOST = '127.0.0.1';
const HEATER_INDEX = 0;

const successObject = {
    nodenr: 75,
    ch_temp_lsb: 121,
    ch_temp_msb: 16,
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
    IO: 8,
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

describe('get-status', () => {
    test('Succesfully', async () => {
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
            new Response(JSON.stringify(successObject)),
        );

        const result = await getStatus(new Logger(), HOST, HEATER_INDEX, USERNAME, PASSWORD);

        const expectedHeaders = {
            Authorization: `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`,
        };

        const path = `data.json?heater=${HEATER_INDEX}`;
        const host = `http://${HOST}/protect/${path}`;

        expect(fetch).toHaveBeenCalledWith(
            host,
            {
                method: 'GET',
                headers: expectedHeaders,
            },
        );

        expect(result?.displayCode).toStrictEqual(126);
        expect(result?.displayText).toStrictEqual('standby');
        expect(result?.isBurning).toStrictEqual(true);
        expect(result?.isFailing).toStrictEqual(false);
        expect(result?.isPumping).toStrictEqual(false);
        expect(result?.isTapping).toStrictEqual(false);

        expect(result?.heating.temperature).toStrictEqual(42.17);
        expect(result?.heating.pressure).toStrictEqual(1.49);

        expect(result?.room1.temperature).toStrictEqual(18.06);
        expect(result?.room1.target).toStrictEqual(17);
        expect(result?.room1.override).toStrictEqual(17);

        expect(result?.tap.temperature).toStrictEqual(41.2);
    });

    test('fail to get status', async () => {
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Failed to fetch'));

        const repsonse = await getStatus(new Logger(), HOST, HEATER_INDEX, USERNAME, PASSWORD);
        expect(repsonse).toBeUndefined();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});
