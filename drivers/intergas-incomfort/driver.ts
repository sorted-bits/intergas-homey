import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { getHeaterList } from './API/api';
import { Heater } from './heater';

interface FormResult {
  success: boolean;
  message?: unknown;
}

interface DeviceTypeFormData {
  deviceType: string;
}

interface FormData {
  host: string | undefined;
  username: string | undefined;
  password: string | undefined;
}

class IncomfortDriver extends Homey.Driver {

  host: string = '';
  username: string | undefined;
  password: string | undefined;
  heaters: Heater[] = [];

  pairingDeviceType: string = 'v2';

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('IncomfortDriver has been initialized');

    this.homey.flow.getActionCard('change_target_temperature_by').registerRunListener(async (args) => {
      this.log('change_target_temperature_by', args);
      args.device.changeTargetTemperatureBy(args);
    });

  }

  createHeaterSettings(heater: Heater): any {

    const deviceId = process.env.DEBUG ? `${heater.id} debug` : `${heater.id}`;

    const setting = {
      name: `Intergas Incomfort (${deviceId})`,
      data: {
        id: deviceId,
        index: heater.index,
      },
      settings: {
        host: this.host,
        username: this.username,
        password: this.password,
        refreshInterval: 10,
      },
    };

    const logoutput = JSON.parse(JSON.stringify(setting));
    logoutput.settings.password = undefined;

    this.log('createHeaterSettings', JSON.stringify(logoutput));

    return setting;
  }

  async onPair(session: PairSession) {
    session.setHandler('list_devices', async () => {
      this.log('list_devices');

      return this.heaters.map((heater) => {
        return this.createHeaterSettings(heater);
      });
    });

    session.setHandler('get_device_model', async (): Promise<string> => {
      return this.pairingDeviceType;
    });

    session.setHandler('device_type_selected', async (data: DeviceTypeFormData): Promise<FormResult> => {
      this.log('device_type_selected', data.deviceType);

      this.pairingDeviceType = data.deviceType;

      return { success: true };
    });


    session.setHandler('form_complete', async (data: FormData): Promise<FormResult> => {
      const logouput = {
        ...data,
        password: data.password?.length.toString()
      }
      this.log('form_complete', JSON.stringify(logouput));

      if (data.host) {
        try {
          this.log('Using login details to check connection', data.host, data.username, data.password?.length);

          const heaters = await getHeaterList(this, data.host, data.username, data.password);

          this.log('Heaterlist during pairing', heaters.length)

          this.host = data.host;
          this.username = data.username ?? '';
          this.password = data.password ?? '';
          this.heaters = heaters;

          this.log('Succesfully paired, returning success');

          return {
            success: true
          };
        } catch (error) {
          this.error('Error occured while pairing', error);
          return {
            success: false,
            message: error,
          };
        }
      } else {
        this.error('No host, username or password provided', data.host, data.username, data.password?.length)

        return {
          success: false,
          message: 'No host provided',
        };
      }
    });

    session.setHandler('showView', async (view) => {
      this.log('showView', view);
    });
  }

}

module.exports = IncomfortDriver;
