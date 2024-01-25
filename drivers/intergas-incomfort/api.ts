import axios from 'axios';

export const fetch = async (host: string, path: string, username?: string, password?  : string): Promise<any> => {

    const auth = username ? 
      {    
        auth : {
          username: username ?? '',
          password: password ?? ''
        }
      }
    : {};
      
    const url = username ? `http://${host}/protect/${path}` : `http://${host}/${path}`;

    const response = await axios.get(
      url,
      auth
    );
    return response.data
  }