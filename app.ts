'use strict';

import Homey from 'homey';

export class IntergasIncomfortApp extends Homey.App {

  async onInit() {
    this.log('Intergas Incomfort has been initialized');    
  }
}

module.exports = IntergasIncomfortApp;
