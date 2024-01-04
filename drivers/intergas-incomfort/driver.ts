import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { IntergasIncomfortApp } from '../../app';

class IncomfortDriver extends Homey.Driver {

  host: string = '';
  username: string = '';
  password: string = '';
  heaters: string[] = [];

  homeyApp(): IntergasIncomfortApp {
    return this.homey.app as IntergasIncomfortApp;
  }

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('IncomfortDriver has been initialized');
  }

  async onPairListDevices() {
    return this.heaters.map((heater, index) => {
      return {
        name: `Intergas Incomfort (${heater})`,
        data: {
          id: heater,
          index: index 
        },
        settings: {
          host: this.host,
          username: this.username,
          password: this.password,
          updateInterval: 10,
        }
      }
    })
  }

  async onPair(session: PairSession) {
    await session.done();

    session.setHandler("list_devices", async () => {
      return this.heaters.map((heater, index) => {
        return {
          name: `Intergas Incomfort (${heater})`,
          data: {
            id: heater,
            index: index 
          },
          settings: {
            host: this.host,
            username: this.username,
            password: this.password,
            updateInterval: 10,
          }
        }
      });
      
    });

    session.setHandler("form_complete", async (data) => {
      if (data.host) {
        try {
          await this.homeyApp().fetch(data.host, 'heaterlist.json', data.username, data.password);
          
          this.host = data.host;
          this.username = data.username;
          this.password = data.password;
          
          session.nextView();
          return {
            success: true,
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
          const response = await this.homeyApp().fetch(this.host, 'heaterlist.json', this.username, this.password);
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
