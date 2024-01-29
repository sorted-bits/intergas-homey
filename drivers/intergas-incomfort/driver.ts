import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { getHeaterList } from './API/api';
import { Heater } from './heater';

interface FormResult {
  success: boolean;
  heaters?: Heater[];
  message?: unknown;
}

class IncomfortDriver extends Homey.Driver {

  host: string = '';
  username: string = '';
  password: string = '';
  heaters: Heater[] = [];

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('IncomfortDriver has been initialized');
  }

  createHeaterSettings(heater: Heater): any {
    return {
      name: `Intergas Incomfort (${heater.id})`,
      data: {
        id: heater.id,
        index: heater.index,
      },
      settings: {
        host: this.host,
        username: this.username,
        password: this.password,
        refreshInterval: 10,
      },
    };
  }

  async onPairListDevices() {
    return this.heaters.map((heater) => {
      return this.createHeaterSettings(heater);
    });
  }

  async onPair(session: PairSession) {
    await session.done();

    session.setHandler('list_devices', async () => {
      return this.heaters.map((heater) => {
        return this.createHeaterSettings(heater);
      });
    });

    session.setHandler('form_complete', async (data): Promise<FormResult> => {
      if (data.host) {
        try {
          const heaters = await getHeaterList(this, data.host, data.username, data.password);

          this.host = data.host;
          this.username = data.username;
          this.password = data.password;

          await session.nextView();

          return {
            success: true,
            heaters,
          };
        } catch (error) {
          return {
            success: false,
            message: error,
          };
        }
      } else {
        return {
          success: false,
          message: 'No host provided',
        };
      }
    });

    session.setHandler('showView', async (view) => {
      if (view === 'loading') {
        try {
          const heaters = await getHeaterList(this, this.host, this.username, this.password);
          this.heaters = heaters ?? [];
          await session.nextView();
        } catch (error) {
          await session.prevView();
        }
      }
    });

    await session.done();
  }

}

module.exports = IncomfortDriver;
