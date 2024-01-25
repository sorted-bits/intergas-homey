import Homey from 'homey';
import { IntergasIncomfortApp } from '../../app';

const INVALID_VALUE = (2 ** 15 - 1) / 100.0

const BITMASK_FAIL = 0x01;
const BITMASK_PUMP = 0x02;
const BITMASK_TAP = 0x04;
const BITMASK_BURNER = 0x08;

const OVERRIDE_MIN_TEMP = 5;
const OVERRIDE_MAX_TEMP = 30;

const MIN_QUERY_INTERVAL = 10;

class IntergasIncomfort extends Homey.Device {

  _isSettingRoomTemp: boolean = false;
  _room1OverrideTemperature: number = 0;
  _room: number = 0;
  _stop: boolean = false;

  homeyApp(): IntergasIncomfortApp {
    return this.homey.app as IntergasIncomfortApp;
  }

  _displayCodeToText(code: number): string {
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

  _convert(mostSignificantByte: number, leastSignificantByte: number): number {
    return (mostSignificantByte * 256 + leastSignificantByte) / 100;
  }

  _ioToBool(io: number, mask: number): boolean {
    const result = io & mask;
    return Boolean(result);
  }

  async _dataToNumber(name: string, capability: string, data: any) {
    const value = this.value(name, data);
    if (value) {
      this.log(`Setting ${capability} to ${value}`);
      try {
        await this.setCapabilityValue(capability, value);
      } catch (ex) {
        this.error(ex);
      }
    }
  }

  value(prefix: string, data: any): number | undefined {
    const result = this._convert(data[`${prefix}_msb`], data[`${prefix}_lsb`])
    if (result === INVALID_VALUE) return undefined;
    return result;
  }

  async booleanChange(capability: string, newValue: boolean, startTrigger?: string, stopTrigger?: string) {
    const trigger = (newValue) ? startTrigger : stopTrigger;

    this.capabilityChange(capability, newValue, trigger);
  }

  async capabilityChange(capability: string, value: any, trigger?: string) {
    try {
      if (value !== this.getCapabilityValue(capability) && trigger) {
        const card = this.homey.flow.getDeviceTriggerCard(trigger);
        await card.trigger(this);
      }

      await this.setCapabilityValue(capability, value);
    } catch (ex) {
      this.error(ex);
    }
  }  

  async updateStatus() {
    var host = this.getSetting("host");
    var username = this.getSetting("username");
    var password = this.getSetting("password");

    var updateInterval = String(this.getSetting('updateInterval') ?? '10');

    try {
      const numberInterval = Number(updateInterval);
      if (numberInterval) {
        if (numberInterval < MIN_QUERY_INTERVAL) {
          updateInterval = String(MIN_QUERY_INTERVAL);
        }
      } else {
        updateInterval = String(MIN_QUERY_INTERVAL)
      }
    } catch (ex) {
      this.error(ex);
    }

    var data = this.getData();
    var url = `data.json?heater=${data['index']}`;
    
    try {
      let response = await this.homeyApp().fetch(host, url, username, password);

      const display_code = response['displ_code'];

      this.capabilityChange('display_code', display_code, 'display_code_changed');
      this.capabilityChange('display_text', this._displayCodeToText(display_code));

      this._dataToNumber('room_temp_1', 'measure_temperature', response);
      this._dataToNumber('ch_pressure', 'measure_water_pressure', response);
      this._dataToNumber('ch_temp', 'measure_cv_water_temperature', response);
      this._dataToNumber('tap_temp', 'measure_tap_water_temperature', response);
  
      const io = response['IO'];
  
      this.booleanChange('is_pumping', this._ioToBool(io, BITMASK_PUMP), "boiler_starts_pumping", "boiler_stops_pumping");
      this.booleanChange('is_tapping', this._ioToBool(io, BITMASK_TAP));
      this.booleanChange('is_burning', this._ioToBool(io, BITMASK_BURNER), "boiler_starts_burning", "boiler_stops_burning");
      this.booleanChange('is_failing', this._ioToBool(io, BITMASK_FAIL));
  
      if (!this._isSettingRoomTemp) {
        if (this._room1OverrideTemperature === 0) {
          this._dataToNumber('room_temp_set_1', 'target_temperature', response);
        } else {
          // Check if the current override temperature is still the same
          const override = this.value(`room_set_ovr_1`, response);
          const targetTemperature = this.value('room_temp_set_1', response);
  
          if (override && override !== this._room1OverrideTemperature) { // the override temperature has changed, maybe through a different app/device
  
            this.log(`Override temperature has changed by someone else to`, override);
  
            this._room1OverrideTemperature = override;
          }
  
          if (targetTemperature === this._room1OverrideTemperature) { // targetTemperature has caught up, we can use that now
            this._room1OverrideTemperature = 0;
            this._dataToNumber('room_temp_set_1', 'target_temperature', response);
  
            this.log(`Target temperature has caught up, using that`, targetTemperature);
          } else {
            // Override temperature has not yet been set onto target_temperature, we better use this
            this._dataToNumber('room_set_ovr_1', 'target_temperature', response);
  
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
      }, Number(updateInterval) * 1000);
    }
  }

  async setOverride(temperature: number, room: number): Promise<void> {
    this.log(`setting override temperature ${temperature} for room ${room}`);

    if (temperature > OVERRIDE_MAX_TEMP || temperature < OVERRIDE_MIN_TEMP) {
      this.error(`We cannot set this temperature, has to be between 5 and 30 degrees`);
      return;
    }

    this._room1OverrideTemperature = temperature;
    this._isSettingRoomTemp = true;

    var data = this.getData();
    var host = this.getSetting("host");
    var username = this.getSetting("username");
    var password = this.getSetting("password");

    let url = `data.json?heater=${data['index']}`
    url += `&thermostat=${room}`
    url += `&setpoint=${(temperature - OVERRIDE_MIN_TEMP) * 10}`;
    await this.homeyApp().fetch(host, url, username, password);
    this._isSettingRoomTemp = false;
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Intergas Incomfort device has been initialized');

    this.registerCapabilityListener("target_temperature", async (value) => {
      this.log('Changing room target temperature to', value);
      this._isSettingRoomTemp = true;

      this.setOverride(value, this._room);
    })

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
