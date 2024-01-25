import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { fetch } from './api';

class IncomfortDriver extends Homey.Driver {

  host: string = '';
  username: string = '';
  password: string = '';
  heaters: string[] = [];

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('IncomfortDriver has been initialized');
  }

  createHeaterSettings(heaterId: string, index: number): any {
    return {
      name: `Intergas Incomfort (${heaterId})`,
      data: {
        id: heaterId,
        index: index 
      },
      settings: {
        host: this.host,
        username: this.username,
        password: this.password,
        refreshInterval: 10,
      }
    };
  }

  async onPairListDevices() {
    return this.heaters.map((heater, index) => {
      return this.createHeaterSettings(heater, index);
    });
  }

  async onPair(session: PairSession) {
    await session.done();

    session.setHandler("list_devices", async () => {
      return this.heaters.map((heater, index) => {
        return this.createHeaterSettings(heater, index);
      });
    });

    session.setHandler("form_complete", async (data) => {
      if (data.host) {
        try {
          
          const response = await fetch(data.host, 'heaterlist.json', data.username, data.password);
          const heaters = (response.heaterlist as string[]).filter(h => h != null);
          
          this.host = data.host;
          this.username = data.username;
          this.password = data.password;
          
          session.nextView();
          return {
            success: true,
            heaters: heaters,
          }
        } catch (error) {
          return {
            success: false,
            message: error
          }
        }
      }
    });

    session.setHandler('showView', async (view) => {
      if (view === 'loading') {
        try {
          const response = await fetch(this.host, 'heaterlist.json', this.username, this.password);
          const heaters = (response.heaterlist as string[]).filter(h => h != null);
          this.heaters = heaters ?? [];
          session.nextView();
        } catch (error) {
          session.prevView();
        }
      }
    });

    await session.done();
  }
}

module.exports = IncomfortDriver;
