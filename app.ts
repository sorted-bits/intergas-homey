'use strict';

import Homey from 'homey';
import axios from 'axios';

export class IntergasIncomfortApp extends Homey.App {

  async fetch(host: string, path: string, username?: string, password?  : string): Promise<any> {

    const auth = username ? 
      {    
        auth : {
          username: username ?? '',
          password: password ?? ''
        }
      }
    : {};
      
    console.log(auth);

    const url = username ? `http://${host}/protect/${path}` : `http://${host}/${path}`;

    this.log('Connecting to ', url)

    const response = await axios.get(
      url,
      auth
    );
    return response.data
  }

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Intergas Incomfort has been initialized');
    
  }
}

module.exports = IntergasIncomfortApp;
