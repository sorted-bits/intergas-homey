import Homey from 'homey';
import { IntergasIncomfortApp } from '../../app';

const INVALID_VALUE = (2 ** 15 - 1) / 100.0

/*
{
  nodenr: 75,
  ch_temp_lsb: 18,
  ch_temp_msb: 23,
  tap_temp_lsb: 42,
  tap_temp_msb: 19,
  ch_pressure_lsb: 149,
  ch_pressure_msb: 0,
  room_temp_1_lsb: 221,
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
  rf_message_rssi: 35,
  rfstatus_cntr: 0
}
*/

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

  _boilerIsPumping = false;

  homeyApp(): IntergasIncomfortApp {
    return this.homey.app as IntergasIncomfortApp;
  }

  _convert(mostSignificantByte: number, leastSignificantByte: number): number {
    return (mostSignificantByte * 256 + leastSignificantByte) / 100;
  }

  _ioToBool(io: number, mask: number): boolean {
    const result = io & mask;
    return Boolean(result);
  }

  _dataToNumber(name: string, capability: string, data: any) {
    const value = this.value(name, data);
    if (value) {
      this.log(`Setting ${capability} to ${value}`);
      this.setCapabilityValue(capability, value);
    }
  }

  value(prefix: string, data: any): number | undefined {
    const result = this._convert(data[`${prefix}_msb`], data[`${prefix}_lsb`])
    if (result === INVALID_VALUE) return undefined;
    return result;
  }

  async updateStatus() {
    var host = this.getSetting("host");
    var username = this.getSetting("username");
    var password = this.getSetting("password");
    var updateInterval = this.getSetting('updateInterval') ?? 10;

    if (updateInterval < MIN_QUERY_INTERVAL) {
      updateInterval = MIN_QUERY_INTERVAL;
    }

    var data = this.getData();
    var url = `data.json?heater=${data['index']}`;
    
    try {
      let response = await this.homeyApp().fetch(host, url, username, password);

      this._dataToNumber('room_temp_1', 'measure_temperature', response);
      this._dataToNumber('ch_pressure', 'measure_water_pressure', response);
      this._dataToNumber('ch_temp', 'measure_cv_water_temperature', response);
      this._dataToNumber('tap_temp', 'measure_tap_water_temperature', response);
  
      const io = response['IO'];
  
      const boilerIsPumping = this._ioToBool(io, BITMASK_PUMP);
  
      this.setCapabilityValue('is_tapping', this._ioToBool(io, BITMASK_TAP));
      this.setCapabilityValue('is_burning', this._ioToBool(io, BITMASK_BURNER));
      this.setCapabilityValue('is_pumping', boilerIsPumping);
      this.setCapabilityValue('is_failing', this._ioToBool(io, BITMASK_FAIL));
  
      if (!this._boilerIsPumping && boilerIsPumping) {
        const trigger = this.homey.flow.getDeviceTriggerCard('boiler_starts_pumping');
        await trigger.trigger(this);
      } else if (this._boilerIsPumping && !boilerIsPumping) {
        const trigger = this.homey.flow.getDeviceTriggerCard('boiler_stops_pumping');
        await trigger.trigger(this);
      }
  
      this._boilerIsPumping = boilerIsPumping;

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
      }, updateInterval * 1000);
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
