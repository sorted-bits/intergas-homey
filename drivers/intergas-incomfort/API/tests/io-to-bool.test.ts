import { BITMASK_BURNER, BITMASK_FAIL, BITMASK_PUMP, BITMASK_TAP } from '../../constants';
import { ioToBool } from '../helpers';

describe('io-to-bool', () => {
    test('burner on', () => {
        expect(ioToBool(BITMASK_BURNER, BITMASK_BURNER)).toStrictEqual(true);
        expect(ioToBool(BITMASK_BURNER + BITMASK_FAIL + BITMASK_PUMP, BITMASK_BURNER)).toStrictEqual(true);
        expect(ioToBool(BITMASK_BURNER + BITMASK_FAIL + BITMASK_PUMP + BITMASK_TAP, BITMASK_BURNER)).toStrictEqual(true);
    });

    test('burner off', () => {
        expect(ioToBool(BITMASK_FAIL + BITMASK_PUMP, BITMASK_BURNER)).toStrictEqual(false);
        expect(ioToBool(BITMASK_FAIL + BITMASK_PUMP + BITMASK_TAP, BITMASK_BURNER)).toStrictEqual(false);
        expect(ioToBool(0, BITMASK_BURNER)).toStrictEqual(false);
    });
});
