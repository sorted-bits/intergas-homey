import Homey from 'homey';

import {
  addCapabilityIfNotExists,
  capabilityChange,
  deprecateCapability,
} from 'homey-helpers';
import { getStatus, setTemperature } from './API/api';
import { OVERRIDE_MAX_TEMP, OVERRIDE_MIN_TEMP, MIN_QUERY_INTERVAL } from './constants';

class IntergasIncomfort extends Homey.Device {

  _isSettingRoomTemp: boolean = false;
  _room1OverrideTemperature: number = 0;
  _room: number = 0;
  _stop: boolean = false;
  heaterIndex: number = 0;
  heaterId: string = '';

  getHeaterSettings = (): { host: string, refreshInterval: number, username?: string, password?: string } => {
    const host = this.getSetting('host');
    const username = this.getSetting('username');
    const password = this.getSetting('password');
    let refreshInterval = this.getSetting('refreshInterval') ?? 10;

    if (!Number(refreshInterval) || refreshInterval < MIN_QUERY_INTERVAL) {
      refreshInterval = 10;
    }

    return {
      host,
      username,
      password,
      refreshInterval,
    };
  }

  async booleanChange(capability: string, value: boolean | undefined, startTrigger: string, stopTrigger: string) {
    if (value !== undefined) {
      const trigger = (value) ? startTrigger : stopTrigger;
      await capabilityChange(this, capability, value, trigger);
    } else {
      this.error(`Trying to set an undefined value to ${capability}`);
    }
  }

  async updateStatus() {
    const {
      host, username, password, refreshInterval,
    } = this.getHeaterSettings();

    try {
      const response = await getStatus(this, host, this.heaterIndex, username, password);
      if (response) {
        await capabilityChange(this, 'display_code', response.displayCode, 'display_code_changed');
        await capabilityChange(this, 'display_text', response.displayText);

        await this.booleanChange('is_pumping', response.isPumping, 'boiler_starts_pumping', 'boiler_stops_pumping');
        await this.booleanChange('is_burning', response.isBurning, 'boiler_starts_burning', 'boiler_starts_burning');

        await capabilityChange(this, 'is_tapping', response.isTapping);
        await capabilityChange(this, 'alarm_generic', response.isFailing);

        await capabilityChange(this, 'measure_temperature', response.room1.temperature);

        await capabilityChange(this, 'measure_pressure', response.heating.pressure * 1000);
        await capabilityChange(this, 'measure_temperature.heater_water', response.heating.temperature);
        await capabilityChange(this, 'measure_temperature.tap_water', response.tap?.temperature);

        if (!this._isSettingRoomTemp) {
          if (this._room1OverrideTemperature === 0) {
            await capabilityChange(this, 'target_temperature', response.room1.target);
          } else {
            // Check if the current override temperature is still the same
            const { override } = response.room1;
            const targetTemperature = response.room1.target;

            if (override && override !== this._room1OverrideTemperature) { // the override temperature has changed, maybe through a different app/device
              this.log('Override temperature has changed by someone else to', override);
              this._room1OverrideTemperature = override;
            }

            if (targetTemperature === this._room1OverrideTemperature) { // targetTemperature has caught up, we can use that now
              this._room1OverrideTemperature = 0;
              await capabilityChange(this, 'target_temperature', targetTemperature);

              this.log('Target temperature has caught up, using that', targetTemperature);
            } else {
              // Override temperature has not yet been set onto target_temperature, we better use this
              await capabilityChange(this, 'target_temperature', override);

              this.log('Target temperature is lagging behind, using override', override);
            }
          }
        }
      } else {
        this.error('Status was undefined');
      }
    } catch (error) {
      this.error('Failed to update status', error);
    }

    if (!this._stop) { // Stop repeating the query,
      await this.homey.setTimeout(this.updateStatus.bind(this), refreshInterval * 1000);
    }
  }

  async setOverride(temperature: number, room: number): Promise<void> {
    this.log(`Setting override temperature ${temperature} for room ${room}`);

    if (temperature > OVERRIDE_MAX_TEMP || temperature < OVERRIDE_MIN_TEMP) {
      this.error('We cannot set this temperature, has to be between 5 and 30 degrees');
      return;
    }

    this._room1OverrideTemperature = temperature;
    this._isSettingRoomTemp = true;

    const { host, username, password } = this.getHeaterSettings();

    await setTemperature(this, host, this.heaterIndex, room, temperature, username, password);

    this._isSettingRoomTemp = false;
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await deprecateCapability(this, 'measure_cv_water_temperature');
    await deprecateCapability(this, 'measure_tap_water_temperature');
    await deprecateCapability(this, 'measure_water_pressure');

    await deprecateCapability(this, 'is_failing');

    await addCapabilityIfNotExists(this, 'display_code');
    await addCapabilityIfNotExists(this, 'display_text');
    await addCapabilityIfNotExists(this, 'measure_pressure');
    await addCapabilityIfNotExists(this, 'measure_temperature.heater_water');
    await addCapabilityIfNotExists(this, 'measure_temperature.tap_water');

    await addCapabilityIfNotExists(this, 'is_burning');
    await addCapabilityIfNotExists(this, 'is_tapping');
    await addCapabilityIfNotExists(this, 'is_pumping');
    await addCapabilityIfNotExists(this, 'alarm_generic');

    this.registerCapabilityListener('target_temperature', async (value) => {
      this.log('Changing room target temperature to', value);
      this._isSettingRoomTemp = true;

      await this.setOverride(value, this._room);
    });

    const data = this.getData();
    this.heaterIndex = data['index'];
    this.heaterId = data['id'];

    this.log(`Intergas Incomfort device (${this.heaterId}:${this.heaterIndex}) has been initialized`);

    await this.updateStatus();
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
    this.log('Intergas Incomfort settings where changed');
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
