import Homey from 'homey';
import { getStatus, setTemperature } from './api';
import { OVERRIDE_MAX_TEMP, OVERRIDE_MIN_TEMP } from './constants';

const INVALID_VALUE = (2 ** 15 - 1) / 100.0

const BITMASK_FAIL = 0x01;
const BITMASK_PUMP = 0x02;
const BITMASK_TAP = 0x04;
const BITMASK_BURNER = 0x08;

const MIN_QUERY_INTERVAL = 10;

class IntergasIncomfort extends Homey.Device {

  _isSettingRoomTemp: boolean = false;
  _room1OverrideTemperature: number = 0;
  _room: number = 0;
  _stop: boolean = false;
  heaterIndex: number = 0;
  heaterId: string = '';

  getHeaterSettings = () : { host: string, refreshInterval: number, username?: string, password?: string } => {
    const host = this.getSetting("host");
    const username = this.getSetting("username");
    const password = this.getSetting("password");
    var refreshInterval = this.getSetting('refreshInterval') ?? 10;

    if (!Number(refreshInterval) || refreshInterval < MIN_QUERY_INTERVAL) {
      refreshInterval = 10;
    }

    return {
      host, 
      username, 
      password,
      refreshInterval
    }
  }

  displayCodeToText(code: number): string {
    const displayCodes: { [id: number]: string} = {
      0:'opentherm',
      15:'boiler ext.',
      24:'frost',
      37:'central heating rf',
      51:'tapwater int.',
      85:'sensortest',
      102:'central heating',
      126:'standby',
      153:'postrun boiler',
      170:'service',
      204:'tapwater',
      231:'postrun ch',
      240:'boiler int.',
      255:'buffer',
    }

    return displayCodes[code] ?? 'Unknown';
  }

  ioToBool(io: number, mask: number): boolean {
    const result = io & mask;
    return Boolean(result);
  }

  generateValueWithPrefix(prefix: string, data: any): number | undefined {
    const convert = (mostSignificantByte: number, leastSignificantByte: number): number => {
      return (mostSignificantByte * 256 + leastSignificantByte) / 100;
    }

    const result = convert(data[`${prefix}_msb`], data[`${prefix}_lsb`])
    if (result === INVALID_VALUE) return undefined;
    return result;
  }  

  async setValueWithPrefix(name: string, capability: string, data: any) {
    const value = this.generateValueWithPrefix(name, data);
    if (value) {
      await this.setCapabilityValue(capability, value);
    }
  }

  async setRefreshInterval(interval: number) {
    await this.setSettings({
      refreshInterval: interval,
    });
  }

  async booleanChange(capability: string, newValue: boolean, startTrigger?: string, stopTrigger?: string) {
    const trigger = (newValue) ? startTrigger : stopTrigger;

    this.capabilityChange(capability, newValue, trigger);
  }

  async capabilityChange(capability: string, value: any, trigger?: string) {
    if (value !== this.getCapabilityValue(capability) && trigger) {
      const card = this.homey.flow.getDeviceTriggerCard(trigger);
      await card.trigger(this);
    }

    await this.setCapabilityValue(capability, value);
  }  

  async updateStatus() {
    const { host, username, password, refreshInterval } = this.getHeaterSettings();

    try {
      let response = await getStatus(host, this.heaterIndex, username, password);

      const display_code = response['displ_code'];

      this.capabilityChange('display_code', display_code, 'display_code_changed');
      this.capabilityChange('display_text', this.displayCodeToText(display_code));

      this.setValueWithPrefix('room_temp_1', 'measure_temperature', response);
      this.setValueWithPrefix('ch_pressure', 'measure_water_pressure', response);
      this.setValueWithPrefix('ch_temp', 'measure_cv_water_temperature', response);
      this.setValueWithPrefix('tap_temp', 'measure_tap_water_temperature', response);
  
      const io = response['IO'];
  
      this.booleanChange('is_pumping', this.ioToBool(io, BITMASK_PUMP), "boiler_starts_pumping", "boiler_stops_pumping");
      this.booleanChange('is_tapping', this.ioToBool(io, BITMASK_TAP));
      this.booleanChange('is_burning', this.ioToBool(io, BITMASK_BURNER), "boiler_starts_burning", "boiler_stops_burning");
      this.booleanChange('is_failing', this.ioToBool(io, BITMASK_FAIL));
  
      if (!this._isSettingRoomTemp) {
        if (this._room1OverrideTemperature === 0) {
          this.setValueWithPrefix('room_temp_set_1', 'target_temperature', response);
        } else {
          // Check if the current override temperature is still the same
          const override = this.generateValueWithPrefix(`room_set_ovr_1`, response);
          const targetTemperature = this.generateValueWithPrefix('room_temp_set_1', response);
  
          if (override && override !== this._room1OverrideTemperature) { // the override temperature has changed, maybe through a different app/device
  
            this.log(`Override temperature has changed by someone else to`, override);
  
            this._room1OverrideTemperature = override;
          }
  
          if (targetTemperature === this._room1OverrideTemperature) { // targetTemperature has caught up, we can use that now
            this._room1OverrideTemperature = 0;
            this.setValueWithPrefix('room_temp_set_1', 'target_temperature', response);
  
            this.log(`Target temperature has caught up, using that`, targetTemperature);
          } else {
            // Override temperature has not yet been set onto target_temperature, we better use this
            this.setValueWithPrefix('room_set_ovr_1', 'target_temperature', response);
  
            this.log(`Target temperature is lagging behind, using override`, override);
          }
        }
      }
    } catch (error) {
      this.error('Failed to update status', error);
    }

    if (!this._stop) { // Stop repeating the query, 
      setTimeout(() => {
        this.updateStatus()
      }, Number(refreshInterval) * 1000);
    }
  }

  async setOverride(temperature: number, room: number): Promise<void> {
    this.log(`Setting override temperature ${temperature} for room ${room}`);

    if (temperature > OVERRIDE_MAX_TEMP || temperature < OVERRIDE_MIN_TEMP) {
      this.error(`We cannot set this temperature, has to be between 5 and 30 degrees`);
      return;
    }

    this._room1OverrideTemperature = temperature;
    this._isSettingRoomTemp = true;

    const { host, username, password } = this.getHeaterSettings();

    try {
      await setTemperature(host, this.heaterIndex, room, temperature, username, password);
    }
    catch (ex) {
    }
    this._isSettingRoomTemp = false;

  }

  async checkCapability(capabilityName: string) {
    if (this.hasCapability(capabilityName) === false) {
      await this.addCapability(capabilityName);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {

    await this.checkCapability('display_code');
    await this.checkCapability('display_text');

    this.registerCapabilityListener("target_temperature", async (value) => {
      this.log('Changing room target temperature to', value);
      this._isSettingRoomTemp = true;

      this.setOverride(value, this._room);
    })
    
    var data = this.getData();
    this.heaterIndex = data['index'];
    this.heaterId = data['id'];

    this.log(`Intergas Incomfort device (${this.heaterId}:${this.heaterIndex}) has been initialized`);

    this.updateStatus();
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Intergas Incomfort device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log("Intergas Incomfort settings where changed");
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('Intergas Incomfort was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Intergas Incomfort has been deleted');
    this._stop = true;
  }
}

module.exports = IntergasIncomfort;
