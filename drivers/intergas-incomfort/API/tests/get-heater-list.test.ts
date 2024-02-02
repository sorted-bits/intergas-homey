import fetch from 'node-fetch';
import { getHeaterList, setTemperature } from '../api';
import { Logger } from '../log';
import { OVERRIDE_MIN_TEMP } from '../../constants';

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const successObject = {
    heaterlist: [
        'some-serial-here',
        null,
        null,
        null,
        'another-serial-here',
        null,
        null,
        null,
    ],
};

const USERNAME = 'admin';
const PASSWORD = 'password';
const HOST = '127.0.0.1';

describe('get-heater-list', () => {
    test('Succesfully', async () => {
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
            new Response(JSON.stringify(successObject)),
        );

        const result = await getHeaterList(new Logger(), HOST, USERNAME, PASSWORD);

        const expectedHeaders = {
            Authorization: `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`,
        };

        const path = 'heaterlist.json';
        const host = `http://${HOST}/protect/${path}`;

        expect(fetch).toHaveBeenCalledWith(
            host,
            {
                method: 'GET',
                headers: expectedHeaders,
            },
        );

        expect(result).toStrictEqual([
            {
                index: 0,
                id: 'some-serial-here',
            },
            {
                index: 4,
                id: 'another-serial-here',
            },
        ]);
    });

    test('fail to get heater list', async () => {
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Failed to fetch'));

        await (expect(async () => {
            await getHeaterList(new Logger(), HOST, USERNAME, PASSWORD);
        }).rejects.toThrow('Failed to fetch'));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});
